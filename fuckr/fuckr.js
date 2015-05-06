// Generated by CoffeeScript 1.8.0
(function() {
  var authentication, chat, chatController, fuckr, loginController, profiles, profilesController, request, updateLocation, updateProfileController, xmpp;

  request = require('request');

  authentication = function($localStorage, $http, $rootScope, $q) {
    var s4, uuid;
    s4 = function() {
      return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    };
    uuid = function() {
      return ("" + (s4()) + (s4()) + "-" + (s4()) + "-" + (s4()) + "-" + (s4()) + "-" + (s4()) + (s4()) + (s4())).toUpperCase();
    };
    $localStorage.deviceAuthentifier = $localStorage.deviceAuthentifier || uuid();
    $rootScope.profileId = $localStorage.profileId;
    return {
      authenticate: function() {
        return $q(function(resolve, reject) {
          return $http.post('https://primus.grindr.com/2.0/session', {
            appName: "Grindr",
            appVersion: "2.2.3",
            authenticationToken: $localStorage.authenticationToken,
            deviceIdentifier: $localStorage.deviceAuthentifier,
            platformName: "Android",
            platformVersion: "19",
            profileId: $localStorage.profileId
          }).error(function() {
            $localStorage.authenticationToken = null;
            return reject('wrong token or no connection');
          }).success(function(data, status, headers, config) {
            var sessionId;
            sessionId = headers()['session-id'];
            $http.defaults.headers.common['Session-Id'] = sessionId;
            $http.defaults.headers.common['Cookies'] = "Session-Id=" + sessionId;
            $rootScope.$emit('authenticated', data.xmppToken);
            $rootScope.authenticated = true;
            return resolve();
          });
        });
      },
      login: function(email, password) {
        return $q(function(resolve, reject) {
          var req;
          req = request.post('https://account.grindr.com/sessions?locale=en');
          req.form({
            email: email,
            password: password
          });
          return req.on('response', function(response) {
            var redirection_link;
            redirection_link = response.headers.location;
            if (redirection_link) {
              $localStorage.authenticationToken = redirection_link.split('authenticationToken=')[1].split('&')[0];
              $rootScope.profileId = $localStorage.profileId = parseInt(redirection_link.split('profileId=')[1]);
              return resolve();
            } else {
              return reject();
            }
          });
        });
      }
    };
  };

  angular.module('authentication', ['ngStorage']).factory('authentication', ['$localStorage', '$http', '$rootScope', '$q', authentication]);

  xmpp = require('simple-xmpp');

  chat = function($http, $localStorage, $rootScope, $q, profiles) {
    var acknowledgeMessages, addMessage, createConversation, s4, sendMessage, uuid;
    s4 = function() {
      return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    };
    uuid = function() {
      return ("" + (s4()) + (s4()) + "-" + (s4()) + "-" + (s4()) + "-" + (s4()) + "-" + (s4()) + (s4()) + (s4())).toUpperCase();
    };
    $localStorage.conversations = $localStorage.conversations || {};
    $localStorage.sentImages = $localStorage.sentImages || [];
    createConversation = function(id) {
      $localStorage.conversations[id] = {
        id: id,
        messages: []
      };
      return profiles.get(id).then(function(profile) {
        return $localStorage.conversations[id].thumbnail = profile.profileImageMediaHash;
      });
    };
    addMessage = function(message) {
      var fromMe, id;
      if (parseInt(message.sourceProfileId) === $localStorage.profileId) {
        fromMe = true;
        id = parseInt(message.targetProfileId);
      } else {
        fromMe = false;
        id = parseInt(message.sourceProfileId);
      }
      if (profiles.isBlocked(id)) {
        return;
      }
      if (message.type === 'block') {
        if ($localStorage.conversations[id]) {
          delete $localStorage.conversations[id];
        }
        if (fromMe) {
          profiles.block(id);
        } else {
          profiles.blockedBy(id);
        }
      } else {
        if (!$localStorage.conversations[id]) {
          createConversation(id);
        }
        $localStorage.conversations[id].lastTimeActive = message.timestamp;
        message = (function() {
          switch (message.type) {
            case 'text':
              return {
                text: message.body
              };
            case 'map':
              return {
                location: angular.fromJson(message.body)
              };
            case 'image':
              return {
                image: angular.fromJson(message.body).imageHash
              };
            default:
              return {
                text: message.type + ' ' + message.body
              };
          }
        })();
        message.fromMe = fromMe;
        $localStorage.conversations[id].messages.push(message);
      }
      return $rootScope.$broadcast('new_message');
    };
    acknowledgeMessages = function(messageIds) {
      return $http.post('https://primus.grindr.com/2.0/confirmChatMessagesDelivered', {
        messageIds: messageIds
      });
    };
    $rootScope.$on('authenticated', function(event, token) {
      xmpp.connect({
        jid: "" + $localStorage.profileId + "@chat.grindr.com",
        password: token,
        host: 'chat.grindr.com',
        preferred: 'PLAIN'
      });
      xmpp.on('online', function(data) {
        chat.connected = true;
        return $http.get('https://primus.grindr.com/2.0/undeliveredChatMessages').then(function(response) {
          var messageIds;
          messageIds = [];
          _(response.data).sortBy(function(message) {
            return message.timestamp;
          }).forEach(function(message) {
            addMessage(message);
            return messageIds.push(message.messageId);
          });
          if (messageIds.length > 0) {
            return acknowledgeMessages(messageIds);
          }
        });
      });
      xmpp.conn.on('stanza', function(stanza) {
        var message;
        if (stanza.is('message')) {
          message = angular.fromJson(stanza.getChildText('body'));
          addMessage(message);
          return acknowledgeMessages([message.messageId]);
        }
      });
      return xmpp.on('error', function(message) {
        $rootScope.chatError = true;
        return alert("chat error: " + message);
      });
    });
    sendMessage = function(type, body, to) {
      var message;
      message = {
        targetProfileId: String(to),
        type: type,
        messageId: uuid(),
        timestamp: Date.now(),
        sourceDisplayName: '',
        sourceProfileId: String($localStorage.profileId),
        body: body
      };
      xmpp.send("" + to + "@chat.grindr.com", angular.toJson(message));
      return addMessage(message);
    };
    return {
      sendText: function(text, to) {
        return sendMessage('text', text, to);
      },
      getConversation: function(id) {
        return $localStorage.conversations[id];
      },
      lastestConversations: function() {
        return _.sortBy($localStorage.conversations, function(conversation) {
          return -conversation.lastTimeActive;
        });
      },
      sentImages: $localStorage.sentImages,
      sendImage: function(imageHash, to) {
        var messageBody;
        messageBody = angular.toJson({
          imageHash: imageHash
        });
        return sendMessage('image', messageBody, to);
      },
      sendLocation: function(to) {
        var messageBody;
        messageBody = angular.toJson({
          lat: $localStorage.grindrParams.lat,
          lon: $localStorage.grindrParams.lon
        });
        return sendMessage('map', messageBody, to);
      },
      block: function(id) {
        return sendMessage('block', null, id);
      }
    };
  };

  angular.module('chat', ['ngStorage', 'profiles']).factory('chat', ['$http', '$localStorage', '$rootScope', '$q', 'profiles', chat]);

  profiles = function($http, $q, $rootScope) {
    var blocked, profileCache;
    profileCache = {};
    blocked = [];
    $rootScope.$on('authenticated', function() {
      return $http.get('https://primus.grindr.com/2.0/blocks').then(function(response) {
        return blocked = _.intersection(response.data.blockedBy, response.data.blocking);
      });
    });
    return {
      nearby: function(params) {
        var deferred;
        deferred = $q.defer();
        $http.post('https://primus.grindr.com/2.0/nearbyProfiles', params).then(function(response) {
          var profile, _i, _len;
          profiles = _.reject(response.data.profiles, function(profile) {
            return _.contains(blocked, profile.profileId);
          });
          for (_i = 0, _len = profiles.length; _i < _len; _i++) {
            profile = profiles[_i];
            if (!profileCache[profile.profileId]) {
              profileCache[profile.profileId] = profile;
            }
          }
          return deferred.resolve(profiles);
        });
        return deferred.promise;
      },
      get: function(id) {
        var deferred;
        if (profileCache[id]) {
          return $q.when(profileCache[id]);
        } else {
          deferred = $q.defer();
          $http.post('https://primus.grindr.com/2.0/getProfiles', {
            targetProfileIds: [id]
          }).then(function(response) {
            return deferred.resolve(response.data[0]);
          });
          return deferred.promise;
        }
      },
      blockedBy: function(id) {
        blocked.push(id);
        return delete profileCache[id];
      },
      block: function(id) {
        this.blockedBy(id);
        return $http.post('https://primus.grindr.com/2.0/blockProfiles', {
          targetProfileIds: [id]
        });
      },
      isBlocked: function(id) {
        return _.contains(blocked, id);
      }
    };
  };

  angular.module('profiles', []).factory('profiles', ['$http', '$q', '$rootScope', profiles]);

  updateLocation = function($rootScope, $http, $localStorage, $interval) {
    return $rootScope.$on('authenticated', function() {
      return $interval(function() {
        return $http.put('https://primus.grindr.com/2.0/location', {
          lat: $localStorage.grindrParams.lat,
          lon: $localStorage.grindrParams.lon,
          profileId: $localStorage.profileId
        });
      }, 60000);
    });
  };

  angular.module('updateLocation', []).service('updateLocation', ['$rootScope', '$http', '$localStorage', '$interval', updateLocation]);

  angular.module('uploadImage', []).factory('uploadImage', [
    '$http', '$q', function($http, $q) {
      var uploadImage;
      uploadImage = function(file, urlFunction) {
        var deferred, img;
        deferred = $q.defer();
        img = new Image;
        img.src = URL.createObjectURL(file);
        img.onload = function() {
          return $http({
            method: "POST",
            url: urlFunction(img.width, img.height),
            data: file,
            headers: {
              'Content-Type': file.type
            }
          }).then(function(response) {
            return deferred.resolve(response.data.mediaHash);
          });
        };
        return deferred.promise;
      };
      return {
        uploadChatImage: function(file) {
          return uploadImage(file, function(width, height) {
            return "https://upload.grindr.com/2.0/chatImage/" + height + ",0," + width + ",0";
          });
        },
        uploadProfileImage: function(file) {
          return uploadImage(file, function(width, height) {
            var squareSize;
            squareSize = _.min([width, height]);
            return "https://upload.grindr.com/2.0/profileImage/" + height + ",0," + width + ",0/" + squareSize + ",0," + squareSize + ",0";
          });
        }
      };
    }
  ]);

  chatController = function($scope, $routeParams, chat, uploadImage) {
    $scope.lastestConversations = chat.lastestConversations();
    $scope.open = function(id) {
      $scope.conversationId = id;
      $scope.conversation = chat.getConversation(id);
      return $scope.sentImages = null;
    };
    if ($routeParams.id) {
      $scope.open($routeParams.id);
    }
    $scope.$on('new_message', function() {
      $scope.conversation = chat.getConversation($scope.conversationId);
      return $scope.lastestConversations = chat.lastestConversations();
    });
    $scope.sendText = function() {
      chat.sendText($scope.message, $scope.conversationId);
      return $scope.message = '';
    };
    $scope.showSentImages = function() {
      return $scope.sentImages = chat.sentImages;
    };
    $scope.$watch('imageFile', function() {
      if ($scope.imageFile) {
        return uploadImage.uploadChatImage($scope.imageFile).then(function(imageHash) {
          return chat.sentImages.push(imageHash);
        });
      }
    });
    $scope.sendImage = function(imageHash) {
      return chat.sendImage(imageHash, $scope.conversationId);
    };
    $scope.sendLocation = function() {
      return chat.sendLocation($scope.conversationId);
    };
    return $scope.block = function() {
      if (confirm('Sure you want to block him?')) {
        chat.block($scope.conversationId);
        $scope.conversationId = null;
        return $scope.lastestConversations = chat.lastestConversations();
      }
    };
  };

  angular.module('chatController', ['ngRoute', 'file-model', 'chat', 'uploadImage']).controller('chatController', ['$scope', '$routeParams', 'chat', 'uploadImage', chatController]);

  loginController = function($scope, $location, authentication) {
    $scope.login = function() {
      return authentication.login($scope.email, $scope.password).then(function() {
        return authentication.authenticate().then(function() {
          return $location.path('/profiles/');
        });
      }, function() {
        return $scope.email = $scope.password = '';
      });
    };
    return $scope.tip = function() {
      return alert("Please sign up using popup window and close it when the 'Create Account' button fades.");
    };
  };

  angular.module('loginController', ['authentication']).controller('loginController', ['$scope', '$location', 'authentication', loginController]);

  profilesController = function($scope, $interval, $localStorage, $routeParams, profiles) {
    var autocomplete;
    $scope.$storage = $localStorage.$default({
      location: 'San Francisco, CA',
      grindrParams: {
        lat: 37.7833,
        lon: -122.4167,
        filter: {
          ageMinimum: 18,
          ageMaximum: 40,
          photoOnly: true,
          onlineOnly: false,
          page: 1,
          quantity: 150
        }
      }
    });
    $scope.refresh = function() {
      return profiles.nearby($scope.$storage.grindrParams).then(function(profiles) {
        return $scope.nearbyProfiles = profiles;
      });
    };
    $scope.refresh();
    $interval($scope.refresh, 60000);
    autocomplete = new google.maps.places.Autocomplete(document.getElementById('location'));
    google.maps.event.addListener(autocomplete, 'place_changed', function() {
      var place;
      place = autocomplete.getPlace();
      if (place.geometry) {
        $scope.$storage.grindrParams.lat = place.geometry.location.lat();
        $scope.$storage.grindrParams.lon = place.geometry.location.lng();
        return $scope.refresh();
      }
    });
    $scope.open = function(id) {
      return profiles.get(id).then(function(profile) {
        return $scope.profile = profile;
      });
    };
    if ($routeParams.id) {
      return $scope.open(parseInt($routeParams.id));
    }
  };

  angular.module('profilesController', ['ngRoute', 'ngStorage', 'profiles']).controller('profilesController', ['$scope', '$interval', '$localStorage', '$routeParams', 'profiles', profilesController]);

  updateProfileController = function($scope, $http, $rootScope, profiles, uploadImage) {
    profiles.get($rootScope.profileId).then(function(profile) {
      alert(angular.toJson(profile));
      return $scope.profile = profile;
    });
    $scope.updateAttribute = function(attribute) {
      var data;
      data = {};
      data[attribute] = $scope.profile[attribute];
      alert(angular.toJson(data));
      return $http.put('https://primus.grindr.com/2.0/profile', data);
    };
    return $scope.$watch('imageFile', function() {
      if ($scope.imageFile) {
        return uploadImage.uploadProfileImage($scope.imageFile).then(function(imageHash) {
          return alert(imageHash);
        }, function() {
          return alert("failed");
        });
      }
    });
  };

  angular.module('updateProfileController', ['file-model', 'uploadImage']).controller('updateProfileController', ['$scope', '$http', '$rootScope', 'profiles', 'uploadImage', updateProfileController]);

  fuckr = angular.module('fuckr', ['ngRoute', 'profiles', 'profilesController', 'authentication', 'loginController', 'chat', 'chatController', 'updateLocation', 'updateProfileController']);

  fuckr.config([
    '$httpProvider', '$routeProvider', function($httpProvider, $routeProvider) {
      var name, route, _i, _len, _ref, _results;
      $httpProvider.defaults.headers.common.Accept = '*/*';
      _ref = ['/profiles/:id?', '/chat/:id?', '/login', '/updateProfile'];
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        route = _ref[_i];
        name = route.split('/')[1];
        _results.push($routeProvider.when(route, {
          templateUrl: "views/" + name + ".html",
          controller: "" + name + "Controller"
        }));
      }
      return _results;
    }
  ]);

  fuckr.run([
    '$location', '$injector', 'authentication', function($location, $injector, authentication) {
      var factory, _i, _len, _ref;
      _ref = ['profiles', 'chat', 'updateLocation'];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        factory = _ref[_i];
        $injector.get(factory);
      }
      return authentication.authenticate().then(function() {
        return $location.path('/profiles/');
      }, function() {
        return $location.path('/login');
      });
    }
  ]);

}).call(this);
