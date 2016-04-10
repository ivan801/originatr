profilesController = ($scope, $interval, $localStorage, $routeParams, $window, $injector, profiles, pinpoint, managedFields) ->
    #left part: filter form and thumbnails
    $scope.$storage = $localStorage.$default
        location: 'San Francisco, CA'
        grindrParams:
            lat: 37.7833
            lon: -122.4167
            filter:
                ageMinimum: null
                ageMaximum: null
                photoOnly: true
                onlineOnly: false
                page: 1
                quantity: 500
    $scope.$storage.grindrParams.filter.quantity = 500 #for upgrades

    $scope.refresh = ->
        #suppress keys if null or empty
        filter = $scope.$storage.grindrParams.filter
        delete filter.ageMinimum unless filter.ageMinimum
        delete filter.ageMaximum unless filter.ageMaximum

        if $scope.view == 'thumbnails'
            profiles.nearby($scope.$storage.grindrParams).then (profiles) ->
                $scope.nearbyProfiles = profiles
        else if $scope.view == 'map'
            pinpoint.everyoneAround().then (locations) ->
                $scope.locations = locations

    $scope.$watch 'view', (view) ->
        $scope.locations = []
        $scope.refresh()
    $scope.view = 'thumbnails'
    $interval($scope.refresh, 300000)

    autocomplete = new google.maps.places.Autocomplete(document.getElementById('location'))
    google.maps.event.addListener autocomplete, 'place_changed', ->
        place = autocomplete.getPlace()
        $scope.$storage.location = place.formatted_address
        if place.geometry
            $scope.$storage.grindrParams.lat = place.geometry.location.lat()
            $scope.$storage.grindrParams.lon = place.geometry.location.lng()
            $scope.refresh()

    #right part: detailed profile view
    $scope.open = (id) ->
        profiles.get(id).then (profile) ->
            $scope.profile = profile
    $scope.open(parseInt($routeParams.id)) if $routeParams.id

    $scope.markerClicked = ->
        $scope.open(parseInt(this.id))

    $scope.isNearbyProfile = (id) ->
        _.findWhere($scope.nearbyProfiles, {profileId: id})

    $scope.pinpoint = (id) ->
        $scope.pinpointing = true
        pinpoint.oneGuy(id).then(
            (location) ->
                $scope.pinpointing = false
                url = "https://maps.google.com/?q=loc:#{location.lat},#{location.lon}"
                $window.open(url, '_blank')
            -> $scope.pinpointing = false
        )

    $scope.block = ->
        $injector.get('chat').block($scope.profile.profileId)
        $scope.nearbyProfiles = $scope.nearbyProfiles.filter (profile) ->
            profile.profileId isnt $scope.profile.profileId
        delete $scope.profile


highResSrc = ->
  return {
    restrict: 'A'
    link: (scope, element, attrs) ->
      element.bind 'load', ->
        angular.element(this).attr("src", attrs.highResSrc)
  }

gramToLocalUnit = ($localStorage) ->
    (grams) ->
        if !grams
            ''
        else if $localStorage.localUnits == 'US'
            "#{(grams / 453.6).toPrecision(3)}lbs"
        else
            "#{(grams / 1000.0).toPrecision(3)}kg"

cmToLocalUnit = ($localStorage) ->
    (cm) ->
        if !cm
            ''
        else if $localStorage.localUnits == 'US'
            inches = Math.round(cm * 0.3937)
            "#{Math.floor(inches / 12)}' #{inches % 12}\""
        else
            "#{(cm / 100).toPrecision(3)}m"

managedFields = ($localStorage, $http) ->
    self = this
    $http.get('https://primus.grindr.com/2.0/managedFields').then (response) ->
        self.fields = response.data.fields

lastTimeActive = ->
    (timestamp) ->
        minutes = Math.floor((new Date() - timestamp) / 60000)
        hours = Math.floor(minutes / 24)
        if minutes <= 5 then "Active Now"
        else if minutes < 60 then "Active #{minutes} mins ago"
        else if hours == 1 then "Active 1 hour ago"
        else if hours < 24 then "Active #{hours} hours ago"
        else if hours < 48 then "Active yesterday"
        else "Active #{Math.floor(hours / 24)} days ago"

angular
    .module('profilesController', ['ngRoute', 'ngStorage', 'ngMap', 'profiles', 'pinpoint'])
    .directive('highResSrc', highResSrc)
    .filter('gramToLocalUnit', ['$localStorage', gramToLocalUnit])
    .filter('cmToLocalUnit', ['$localStorage', cmToLocalUnit])
    .filter('lastTimeActive', lastTimeActive)
    .service('managedFields', managedFields)
    .controller 'profilesController',
               ['$scope', '$interval', '$localStorage', '$routeParams', '$window', '$injector', 'profiles', 'pinpoint', profilesController]
