// Generated by CoffeeScript 1.10.0
var authentication, chat, chatController, cmToLocalUnit, gramToLocalUnit, lastTimeActive, loginController, mToLocalUnit, onEnter, pinpoint, profiles, profilesController, scrollDownOnNewConversation, settingsController, weightInput;

window.fuckr = angular.module('fuckr', ['ngRoute', 'ngMap', 'ngStorage']);

fuckr.constant('API_URL', 'https://grindr.mobi/v3/');

fuckr.config([
  '$httpProvider', '$routeProvider', '$compileProvider', function($httpProvider, $routeProvider, $compileProvider) {
    var k, len, name, ref, route;
    $httpProvider.defaults.headers.common.Accept = '*/*';
    $httpProvider.interceptors.push(function($rootScope) {
      return {
        responseError: function(response) {
          var message;
          if (response.status === -1) {
            return;
          }
          message = (function() {
            switch (false) {
              case response.status !== 0:
                return "Can't reach Grindr servers.";
              case !(response.status >= 500):
                return "Grindr servers temporarily unavailable (HTTP " + response.status + ")";
              default:
                return "Unexpected error (HTTP " + response.status + "). Check out http://fuckr.me/ for updates.";
            }
          })();
          alert(message);
          return $rootScope.connectionError = true;
        }
      };
    });
    ref = ['/login', '/profiles/:id?', '/chat/:id?', '/settings'];
    for (k = 0, len = ref.length; k < len; k++) {
      route = ref[k];
      name = route.split('/')[1];
      $routeProvider.when(route, {
        templateUrl: "views/" + name + ".html",
        controller: name + "Controller"
      });
    }
    $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|file|mailto|chrome-extension):/);
    return $compileProvider.imgSrcSanitizationWhitelist(/^\s*(https?|ftp|file|mailto|chrome-extension):/);
  }
]);

fuckr.run([
  '$location', '$injector', '$rootScope', 'authentication', function($location, $injector, $rootScope, authentication) {
    var factory, k, len, ref;
    $rootScope.runningNodeWebkit = true;
    if (navigator.onLine) {
      ref = ['profiles', 'chat'];
      for (k = 0, len = ref.length; k < len; k++) {
        factory = ref[k];
        $injector.get(factory);
      }
      authentication.login().then(function() {
        return $location.path('/profiles/');
      }, function() {
        return $location.path('/login');
      });
      window.addEventListener('offline', function() {
        return $rootScope.connectionError = true;
      });
    } else {
      alert('No Internet connection');
    }
    return window.addEventListener('online', function() {
      return authentication.login().then(function() {
        return $rootScope.connectionError = false;
      });
    });
  }
]);

authentication = function($localStorage, $http, $rootScope, $q, $location, API_URL) {
  var getGCMToken, useCredentials;
  getGCMToken = function() {
    return $q(function(resolve, reject) {
      if ($localStorage.gcmToken) {
        return resolve($localStorage.gcmToken);
      } else {
        return chrome.instanceID.getToken({
          authorizedEntity: "1036042917246",
          scope: "gcm"
        }, function(token) {
          $localStorage.gcmToken = token;
          return resolve($localStorage.gcmToken);
        });
      }
    });
  };
  useCredentials = function(data) {
    if (data.authToken) {
      $localStorage.authToken = data.authToken;
    }
    $http.defaults.headers.common['Session-Id'] = data.sessionId;
    $http.defaults.headers.common['Authorization'] = "Grindr3 " + data.sessionId;
    $rootScope.profileId = data.profileId;
    $rootScope.$emit('authenticated', data.xmppToken);
    return $rootScope.authenticated = true;
  };
  return {
    login: function() {
      return $q(function(resolve, reject) {
        if (!($localStorage.authToken || ($localStorage.email && $localStorage.password))) {
          reject('no login credentials');
          return;
        }
        return getGCMToken().then(function(token) {
          var params;
          params = {
            email: $localStorage.email,
            token: token
          };
          return $http.post(API_URL + 'sessions', {
            authToken: $localStorage.authToken,
            email: $localStorage.email,
            password: !$localStorage.authToken ? $localStorage.password : void 0,
            token: token
          }).success(function(data) {
            useCredentials(data);
            return resolve();
          }).error(function() {
            $localStorage.authToken = null;
            return reject('Login error');
          });
        });
      });
    },
    signup: function(email, password, dateOfBirth) {
      return $q(function(resolve, reject) {
        return getGCMToken().then(function(token) {
          return $http.post(API_URL + 'users', {
            birthday: Date.parse(dateOfBirth),
            email: email,
            password: password,
            optIn: false,
            token: token
          }).success(function(data) {
            useCredentials(data);
            return resolve();
          }).error(reject);
        });
      });
    }
  };
};

fuckr.factory('authentication', ['$localStorage', '$http', '$rootScope', '$q', '$location', 'API_URL', authentication]);

chat = function($http, $localStorage, $rootScope, $q, profiles, authentication, API_URL) {
  var acknowledgeMessages, addMessage, client, createConversation, gui, jacasr, lastConnection, nwWindow, s4, sendMessage, uuid;
  jacasr = require('jacasr');
  nwWindow = gui = require('nw.gui').Window.get();
  s4 = function() {
    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  };
  uuid = function() {
    return ("" + (s4()) + (s4()) + "-" + (s4()) + "-" + (s4()) + "-" + (s4()) + "-" + (s4()) + (s4()) + (s4())).toUpperCase();
  };
  client = {};
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
    var fromMe, id, timestamp;
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
      delete $localStorage.conversations[id];
      if (fromMe) {
        profiles.block(id);
      } else {
        profiles.blockedBy(id);
      }
    } else {
      if (!$localStorage.conversations[id]) {
        createConversation(id);
      }
      timestamp = message.timestamp;
      $localStorage.conversations[id].lastTimeActive = timestamp;
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
      message.timestamp = timestamp;
      $localStorage.conversations[id].messages.push(message);
      if (!fromMe) {
        $localStorage.conversations[id].unread = true;
        document.getElementById('notification').play();
      }
    }
    return $rootScope.$broadcast('new_message');
  };
  acknowledgeMessages = function(messageIds) {
    return $http.put(API_URL + 'me/chat/messages?confirmed=true', {
      messageIds: messageIds
    });
  };
  lastConnection = null;
  $rootScope.$on('authenticated', function(event, token) {
    lastConnection || (lastConnection = Date.now());
    client = new jacasr.Client({
      login: $localStorage.profileId,
      password: token,
      domain: 'chat.grindr.com'
    });
    client.on('ready', function() {
      chat.connected = true;
      return $http.get(API_URL + 'me/chat/messages?undelivered=true').then(function(response) {
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
    client.on('message', function(_, json) {
      var message;
      message = angular.fromJson(json);
      return addMessage(message);
    });
    client.on('close', function() {
      var now;
      now = Date.now();
      if ((now - lastConnection) < 60000) {
        $rootScope.chatError = true;
        return alert("XMPP chat error. If you're using public wifi, XMPP protocol is probably blocked.");
      } else {
        lastConnection = now;
        client.disconnect();
        return authentication.login();
      }
    });
    window.onbeforeunload = function() {
      return client.disconnect();
    };
    return nwWindow.on('close', function() {
      client.disconnect();
      return this.close(true);
    });
  });
  sendMessage = function(type, body, to, save) {
    var message;
    if (save == null) {
      save = true;
    }
    message = {
      targetProfileId: String(to),
      type: type,
      messageId: uuid(),
      timestamp: Date.now(),
      sourceDisplayName: '',
      sourceProfileId: String($localStorage.profileId),
      body: body
    };
    client.write("<message from='" + $localStorage.profileId + "@chat.grindr.com/jacasr' to='" + to + "@chat.grindr.com' xml:lang='' type='chat' id='" + message.messageId + "'><body>" + (_.escape(angular.toJson(message))) + "</body><markable xmlns='urn:xmpp:chat-markers:0'/></message>");
    if (save) {
      return addMessage(message);
    }
  };
  return {
    sendText: function(text, to, save) {
      if (save == null) {
        save = true;
      }
      return sendMessage('text', text, to, save);
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
    },
    "delete": function(id) {
      return delete $localStorage.conversations[id];
    }
  };
};

fuckr.factory('chat', ['$http', '$localStorage', '$rootScope', '$q', 'profiles', 'authentication', 'API_URL', chat]);

pinpoint = function($q, $localStorage, profiles) {
  var getNearbyProfiles, randomizedLocation, trilaterate;
  trilaterate = function(beacons) {
    var P1, P2, P3, d, deg, earthR, ex, ey, ez, i, j, rad, ref, triPt, x, y, z;
    earthR = 6371;
    rad = function(deg) {
      return deg * math.pi / 180;
    };
    deg = function(rad) {
      return rad * 180 / math.pi;
    };
    ref = beacons.map(function(beacon) {
      return [earthR * math.cos(rad(beacon.lat)) * math.cos(rad(beacon.lon)), earthR * math.cos(rad(beacon.lat)) * math.sin(rad(beacon.lon)), earthR * math.sin(rad(beacon.lat))];
    }), P1 = ref[0], P2 = ref[1], P3 = ref[2];
    ex = math.divide(math.subtract(P2, P1), math.norm(math.subtract(P2, P1)));
    i = math.dot(ex, math.subtract(P3, P1));
    ey = math.divide(math.subtract(math.subtract(P3, P1), math.multiply(i, ex)), math.norm(math.subtract(math.subtract(P3, P1), math.multiply(i, ex))));
    ez = math.cross(ex, ey);
    d = math.norm(math.subtract(P2, P1));
    j = math.dot(ey, math.subtract(P3, P1));
    x = (math.pow(beacons[0].dist, 2) - math.pow(beacons[1].dist, 2) + math.pow(d, 2)) / (2 * d);
    y = (math.pow(beacons[0].dist, 2) - math.pow(beacons[2].dist, 2) + math.pow(i, 2) + math.pow(j, 2)) / (2 * j) - (i / j * x);
    z = math.sqrt(math.abs(math.pow(beacons[0].dist, 2) - math.pow(x, 2) - math.pow(y, 2)));
    triPt = math.add(math.add(math.add(P1, math.multiply(x, ex)), math.multiply(y, ey)), math.multiply(z, ez));
    return {
      lat: deg(math.asin(math.divide(triPt[2], earthR))),
      lon: deg(math.atan2(triPt[1], triPt[0]))
    };
  };
  randomizedLocation = function() {
    return {
      lat: $localStorage.location.lat + ((Math.random() - 0.5) / 100),
      lon: $localStorage.location.lon + ((Math.random() - 0.5) / 100)
    };
  };
  getNearbyProfiles = function(locations) {
    var promises;
    promises = locations.map(function(location) {
      return profiles.nearby(location);
    });
    return $q.all(promises);
  };
  return {
    oneGuy: function(id) {
      var beacons, deferred;
      deferred = $q.defer();
      beacons = [randomizedLocation(), randomizedLocation(), randomizedLocation()];
      getNearbyProfiles(beacons).then(function(results) {
        var i, k, profile;
        for (i = k = 0; k <= 2; i = ++k) {
          profile = _.findWhere(results[i], {
            profileId: id
          });
          if (!profile) {
            return deferred.reject();
          }
          beacons[i].dist = profile.distance;
        }
        return deferred.resolve(trilaterate(beacons));
      });
      return deferred.promise;
    },
    everyoneAround: function() {
      var beacons, deferred;
      deferred = $q.defer();
      beacons = [randomizedLocation(), randomizedLocation(), randomizedLocation()];
      getNearbyProfiles(beacons).then(function(results) {
        var distances, i, id, idToDistances, idToLocation, k, l, len, n, name1, profile, ref;
        idToDistances = {};
        for (i = k = 0; k <= 2; i = ++k) {
          ref = results[i];
          for (l = 0, len = ref.length; l < len; l++) {
            profile = ref[l];
            if (!profile.distance) {
              continue;
            }
            idToDistances[name1 = profile.profileId] || (idToDistances[name1] = []);
            idToDistances[profile.profileId].push(profile.distance);
          }
        }
        idToLocation = {};
        for (id in idToDistances) {
          distances = idToDistances[id];
          if (!(distances.length === 3)) {
            continue;
          }
          for (i = n = 0; n <= 2; i = ++n) {
            beacons[i].dist = distances[i];
          }
          idToLocation[id] = trilaterate(beacons);
        }
        return deferred.resolve(idToLocation);
      });
      return deferred.promise;
    }
  };
};

fuckr.factory('pinpoint', ['$q', '$localStorage', 'profiles', pinpoint]);

profiles = function($http, $q, $rootScope, API_URL) {
  var blocked;
  blocked = [];
  $rootScope.$on('authenticated', function() {
    return $http.get(API_URL + 'me/blocks').then(function(response) {
      return blocked = _.union(response.blockedBy, response.blocking);
    });
  });
  return {
    nearby: function(location) {
      var deferred, geohash;
      deferred = $q.defer();
      geohash = Geohash.encode(location.lat, location.lon, 12);
      $http.get(API_URL + "locations/" + geohash + "/profiles/").then(function(response) {
        profiles = _.reject(response.data.profiles, function(profile) {
          return _.contains(blocked, profile.profileId);
        });
        return deferred.resolve(profiles);
      });
      return deferred.promise;
    },
    get: function(id) {
      var deferred;
      deferred = $q.defer();
      $http.get(API_URL + "profiles/" + id).then(function(response) {
        return deferred.resolve(response.data.profiles[0]);
      });
      return deferred.promise;
    },
    blockedBy: function(id) {
      return blocked.push(id);
    },
    block: function(id) {
      return $http.post(API_URL + "blocks/" + id).then((function(_this) {
        return function() {
          return _this.blockedBy(id);
        };
      })(this));
    },
    isBlocked: function(id) {
      return _.contains(blocked, id);
    }
  };
};

fuckr.factory('profiles', ['$http', '$q', '$rootScope', 'API_URL', profiles]);

fuckr.factory('uploadImage', [
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
          return 'https://g3-beta-upload.grindr.com/v3/me/pics?type=chat';
        });
      },
      uploadProfileImage: function(file) {
        return uploadImage(file, function(width, height) {
          var squareSize;
          squareSize = _.min([width, height]);
          return "https://g3-beta-upload.grindr.com/v3/me/pics?type=profile&thumbCoords=" + squareSize + ",0," + squareSize + ",0";
        });
      }
    };
  }
]);

chatController = function($scope, $routeParams, chat, uploadImage) {
  var clipboard;
  $scope.lastestConversations = chat.lastestConversations();
  $scope.open = function(id) {
    $scope.conversationId = id;
    $scope.conversation = chat.getConversation(id);
    if ($scope.conversation) {
      $scope.conversation.unread = false;
    }
    return $scope.sentImages = null;
  };
  if ($routeParams.id) {
    $scope.open($routeParams.id);
  }
  $scope.$on('new_message', function() {
    if ($scope.conversationId) {
      $scope.conversation = chat.getConversation($scope.conversationId);
      if ($scope.conversation) {
        $scope.conversation.unread = false;
      }
      $scope.$apply();
    }
    return $scope.lastestConversations = chat.lastestConversations();
  });
  $scope.sendText = function() {
    if ($scope.message) {
      chat.sendText($scope.message, $scope.conversationId);
      return $scope.message = '';
    }
  };
  $scope.showSentImages = function() {
    return $scope.sentImages = chat.sentImages;
  };
  $scope.clearSentImages = function() {
    if (window.confirm("Sure you want to delete all saved images?")) {
      return chat.sentImages.splice(0, chat.sentImages.length);
    }
  };
  $scope.$watch('imageFile', function() {
    if ($scope.imageFile) {
      $scope.uploading = true;
      return uploadImage.uploadChatImage($scope.imageFile).then(function(imageHash) {
        $scope.uploading = false;
        if (imageHash) {
          return chat.sentImages.push(imageHash);
        }
      });
    }
  });
  $scope.sendImage = function(imageHash) {
    return chat.sendImage(imageHash, $scope.conversationId);
  };
  $scope.sendLocation = function() {
    return chat.sendLocation($scope.conversationId);
  };
  $scope.block = function() {
    if (confirm('Sure you want to block him?')) {
      chat.block($scope.conversationId);
      $scope.conversationId = null;
      return $scope.lastestConversations = chat.lastestConversations();
    }
  };
  $scope["delete"] = function() {
    if (confirm('Sure you want to delete this conversation?')) {
      chat["delete"]($scope.conversationId);
      $scope.conversationId = null;
      return $scope.lastestConversations = chat.lastestConversations();
    }
  };
  clipboard = require('nw.gui').Clipboard.get();
  return $scope.copyToClipboard = function() {
    var text;
    text = $scope.conversation.messages.map(function(message) {
      if (message.text) {
        return message.text;
      } else if (message.image) {
        return "http://cdns.grindr.com/grindr/chat/" + message.image;
      } else if (message.location) {
        return "https://maps.google.com/?q=loc:" + message.location.lat + "," + message.location.lon;
      }
    }).join('\n\n');
    return clipboard.set(text);
  };
};

onEnter = function($parse) {
  return {
    restrict: 'A',
    link: function(scope, element, attrs) {
      var ENTER, SHIFT, callback, ref, shiftDown;
      ref = [false, 16, 13], shiftDown = ref[0], SHIFT = ref[1], ENTER = ref[2];
      callback = $parse(attrs.onEnter, null, true);
      element.bind('keyup', function(event) {
        if (event.which === SHIFT) {
          return shiftDown = false;
        }
      });
      return element.bind('keydown', function(event) {
        if (event.which === SHIFT) {
          return shiftDown = true;
        } else if (event.which === ENTER && !shiftDown) {
          scope.$apply(function() {
            return callback(scope);
          });
          return event.preventDefault();
        }
      });
    }
  };
};

scrollDownOnNewConversation = function() {
  return {
    restrict: 'A',
    link: function(scope, element) {
      return scope.$watch('conversationId', function(value) {
        if (value) {
          return setTimeout((function() {
            return element[0].scrollTop = 100000;
          }), 100);
        }
      });
    }
  };
};

fuckr.controller('chatController', ['$scope', '$routeParams', 'chat', 'uploadImage', chatController]).directive('onEnter', onEnter).directive('scrollDownOnNewConversation', scrollDownOnNewConversation);

loginController = function($scope, $location, $localStorage, authentication) {
  $scope.$storage = $localStorage;
  $scope.login = function() {
    $scope.logging = true;
    return authentication.login().then(function() {
      return $location.path('/profiles/');
    }, function() {
      return $scope.logging = $scope.$storage.email = $scope.$storage.password = null;
    });
  };
  return $scope.signup = function() {
    $scope.logging = true;
    return authentication.signup($scope.$storage.email, $scope.$storage.password, $scope.dateOfBirth).then(function() {
      return $location.path('/profiles/');
    }, function() {
      return $scope.logging = $scope.dateOfBirth = $scope.$storage.email = $scope.$storage.password = null;
    });
  };
};

fuckr.controller('loginController', ['$scope', '$location', '$localStorage', 'authentication', loginController]);

profilesController = function($scope, $interval, $localStorage, $routeParams, $window, $injector, profiles, pinpoint) {
  var autocomplete;
  $scope.$storage = $localStorage.$default({
    location: {
      name: 'San Francisco, CA',
      lat: 37.7833,
      lon: -122.4167
    }

    /*
        geohash: '9q8yyq4zsjse'
    filter:
        ageMinimum: null
        ageMaximum: null
        photoOnly: true
        online: false
     */
  });
  $scope.refresh = function() {
    var filter;
    filter = $scope.$storage.grindrParams.filter;
    if (!filter.ageMinimum) {
      delete filter.ageMinimum;
    }
    if (!filter.ageMaximum) {
      delete filter.ageMaximum;
    }
    if ($scope.view === 'thumbnails') {
      return profiles.nearby($scope.$storage.location).then(function(profiles) {
        return $scope.nearbyProfiles = profiles;
      });
    } else if ($scope.view === 'map') {
      return pinpoint.everyoneAround().then(function(locations) {
        return $scope.locations = locations;
      });
    }
  };
  $scope.changeFilter = function(filterName) {
    var filterValue;
    filterValue = $scope.$storage.filter[filterName];
    if (filterValue) {
      $scope.$storage.grindrParams.filter[filterName + "Ids"] = [filterValue];
    } else {
      delete $scope.$storage.grindrParams.filter[filterName + "Ids"];
    }
    return $scope.refresh();
  };
  $scope.$watch('view', function(view) {
    $scope.locations = [];
    return $scope.refresh();
  });
  $scope.view = 'thumbnails';
  $interval($scope.refresh, 420000);
  autocomplete = new google.maps.places.Autocomplete(document.getElementById('location'));
  google.maps.event.addListener(autocomplete, 'place_changed', function() {
    var place;
    place = autocomplete.getPlace();
    $scope.$storage.location.name = place.formatted_address;
    if (place.geometry) {
      $scope.$storage.location.lat = place.geometry.location.lat();
      $scope.$storage.location.lon = place.geometry.location.lng();
      return $scope.refresh();
    }
  });
  $scope.open = function(id) {
    return profiles.get(id).then(function(profile) {
      return $scope.profile = profile;
    });
  };
  if ($routeParams.id) {
    $scope.open(parseInt($routeParams.id));
  }
  $scope.markerClicked = function() {
    return $scope.open(parseInt(this.id));
  };
  $scope.isNearbyProfile = function(id) {
    return _.findWhere($scope.nearbyProfiles, {
      profileId: id
    });
  };
  $scope.pinpoint = function(id) {
    $scope.pinpointing = true;
    return pinpoint.oneGuy(id).then(function(location) {
      var url;
      $scope.pinpointing = false;
      url = "https://maps.google.com/?q=loc:" + location.lat + "," + location.lon;
      return $window.open(url, '_blank');
    }, function() {
      return $scope.pinpointing = false;
    });
  };
  $scope.block = function() {
    $injector.get('chat').block($scope.profile.profileId);
    $scope.nearbyProfiles = $scope.nearbyProfiles.filter(function(profile) {
      return profile.profileId !== $scope.profile.profileId;
    });
    return delete $scope.profile;
  };
  return $scope.sexualPositions = ['', 'Top', 'Bottom', 'Versatile', 'Vers Bottom', 'Vers Top', 'Oral Only'];
};

gramToLocalUnit = function($localStorage) {
  return function(grams) {
    if (!grams) {
      return '';
    } else if ($localStorage.localUnits === 'US') {
      return ((grams / 453.6).toPrecision(3)) + "lbs";
    } else {
      return ((grams / 1000.0).toPrecision(3)) + "kg";
    }
  };
};

cmToLocalUnit = function($localStorage) {
  return function(cm) {
    var inches;
    if (!cm) {
      return '';
    } else if ($localStorage.localUnits === 'US') {
      inches = Math.round(cm * 0.3937);
      return (Math.floor(inches / 12)) + "' " + (inches % 12) + "\"";
    } else {
      return ((cm / 100).toPrecision(3)) + "m";
    }
  };
};

mToLocalUnit = function($localStorage) {
  return function(m) {
    if (!m) {
      return '';
    } else if ($localStorage.localUnits === 'US') {
      return (m * 0.000621371).toPrecision(3) + ' miles';
    } else {
      return (m / 1000).toPrecision(3) + 'km';
    }
  };
};

lastTimeActive = function() {
  return function(timestamp) {
    var hours, minutes;
    minutes = Math.floor((new Date() - timestamp) / 60000);
    hours = Math.floor(minutes / 60);
    if (minutes <= 5) {
      return "Active Now";
    } else if (minutes < 60) {
      return "Active " + minutes + " mins ago";
    } else if (hours === 1) {
      return "Active 1 hour ago";
    } else if (hours < 24) {
      return "Active " + hours + " hours ago";
    } else if (hours < 48) {
      return "Active yesterday";
    } else {
      return "Active " + (Math.floor(hours / 24)) + " days ago";
    }
  };
};

fuckr.filter('gramToLocalUnit', ['$localStorage', gramToLocalUnit]).filter('cmToLocalUnit', ['$localStorage', cmToLocalUnit]).filter('mToLocalUnit', ['$localStorage', mToLocalUnit]).filter('lastTimeActive', lastTimeActive).controller('profilesController', ['$scope', '$interval', '$localStorage', '$routeParams', '$window', '$injector', 'profiles', 'pinpoint', profilesController]);

settingsController = function($scope, $http, $localStorage, profiles, uploadImage, API_URL) {
  var base;
  $scope.$storage = $localStorage;
  (base = $scope.$storage).localUnits || (base.localUnits = navigator.locale === 'en-US' ? 'US' : 'metric');
  $scope.profile = {};
  profiles.get($localStorage.profileId).then(function(profile) {
    return $scope.profile = profile;
  });
  $scope.updateAttribute = function(attribute) {
    var data;
    data = {};
    data[attribute] = $scope.profile[attribute];
    if (data !== {}) {
      return $http.put(API_URL + 'me/profile', data);
    }
  };
  $scope.deleteProfile = function() {
    if (confirm("Sure you want to delete your profile")) {
      return $http["delete"](API_URL + 'me/profile').then(function() {
        return $scope.logoutAndRestart();
      });
    }
  };
  return $scope.$watch('imageFile', function() {
    if ($scope.imageFile) {
      $scope.uploading = true;
      return uploadImage.uploadProfileImage($scope.imageFile).then(function() {
        return alert("Image up for review by some Grindr™ monkey");
      }, function() {
        return alert("Image upload failed");
      })["finally"](function() {
        return $scope.uploading = false;
      });
    }
  });
};

weightInput = function() {
  return {
    restrict: 'A',
    require: 'ngModel',
    link: function(scope, element, attributes, ngModel) {
      ngModel.$formatters.push(function(gramsInput) {
        return gramsInput / 1000;
      });
      return ngModel.$parsers.push(function(kgInput) {
        return kgInput * 1000;
      });
    }
  };
};

fuckr.controller('settingsController', ['$scope', '$http', '$localStorage', 'profiles', 'uploadImage', 'API_URL', settingsController]).directive('weightInput', weightInput);

fuckr.directive('nonDraggable', function() {
  return {
    restrict: 'A',
    link: function(_, element) {
      return element.bind('dragstart', function(event) {
        return event.preventDefault();
      });
    }
  };
});

fuckr.directive('emoji', function() {
  var runningOnMac, useOpenSansEmoji;
  runningOnMac = typeof process !== 'undefined' && process.platform === 'darwin';
  useOpenSansEmoji = function(_, element) {
    return element.css({
      'font-family': 'font-family',
      'sans-serif, OpenSansEmoji': 'sans-serif, OpenSansEmoji'
    });
  };
  return {
    restrict: 'A',
    link: runningOnMac ? _.noop : useOpenSansEmoji
  };
});

fuckr.directive('highResSrc', function() {
  return {
    restrict: 'A',
    link: function(scope, element, attrs) {
      return element.bind('load', function() {
        return angular.element(this).attr("src", attrs.highResSrc);
      });
    }
  };
});

fuckr.directive('fileModel', [
  '$parse', function($parse) {
    return {
      restrict: 'A',
      link: function(scope, element, attrs) {
        var model, modelSetter;
        model = $parse(attrs.fileModel);
        modelSetter = model.assign;
        return element.bind('change', function() {
          scope.$apply(function() {});
          if (element[0].files.length > 1) {
            return modelSetter(scope, element[0].files);
          } else {
            return modelSetter(scope, element[0].files[0]);
          }
        });
      }
    };
  }
]);

if (typeof process !== 'undefined' && process.versions['node-webkit']) {
  fuckr.directive('target', function() {
    var gui;
    gui = require('nw.gui');
    window.open = function(url, target) {
      if (target === '_blank') {
        return gui.Shell.openExternal(url);
      }
    };
    return {
      restrict: 'A',
      scope: {
        target: '@',
        href: '@'
      },
      link: function($scope, $element) {
        if ($scope.target === '_blank') {
          return $element.bind('click', function(event) {
            event.preventDefault();
            return gui.Shell.openExternal($scope.href);
          });
        }
      }
    };
  });
}
