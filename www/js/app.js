// Copyright 2016 Joël Jungo <j.jungo@gmail.com>
//
// Licensed under the Apache License, Version 2.0 (the 'License')
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/** parse zones and return an array containing all zones.
 * @param zonesStr:    string containing all zones. Zone have to be separated by
 *                     space and must be number value (2 digits are require).
 * @param max: max zone allowed
 * @return: array of zones, null if zones provided aren't valid.
 */
function parseZones (zonesStr, max) {
  var str,
    reg,
    parsedZones
  str = zonesStr.split(' ')
  if (str.length > max) {
    return null
  }
  reg = new RegExp('^\\d{2}$')
  str = zonesStr.split(' ')
  parsedZones = []

  str.forEach(function (item, index) {
    if (reg.test(item)) {
      parsedZones[index] = item
    }
  })

  if (parsedZones.length !== str.length) {
    return null
  } else {
    return parsedZones
  }
}

function sendSms (ionicLoading, sms, cordovaToast, state, cordovaSms, ionicHistory) {
  document.addEventListener('deviceready', function () {
    var options = {
      replaceLineBreaks: false, // true to replace \n by a new line, false by default
      android: {
        intent: '' // send SMS with the native android SMS messaging
          // intent: '' // send SMS without open any other app
          // intent: 'INTENT' // send SMS inside a default SMS app
      }
    }

    ionicLoading.show({
      template: 'Envoi du sms...'
    })
    cordovaSms
      .send(sms.number, sms.message, options)
      .then(function () {
        // Success! SMS was sent
        console.log('SMS has been sended')
        ionicLoading.hide()

        cordovaToast.showLongBottom('Ticket commandé!').then(function (success) {
          // success
          console.log('Ticket has been commanded')
        }, function (error) {
          // error
          window.alert('Error on toast')
          console.log('Error on toast' + error)
        })

        state.go('home')
      }, function (error) {
        // some time ionicLoading.show() is executed to late and we
        // can't hide the box...
        setTimeout(function () {
          // An error occurred
          ionicLoading.hide()
          window.alert('Erreur! SMS non envoyé!')
          console.log('Error: ' + error)
          resetApp(ionicHistory, state)
        }, 5)
      })
  })
}

function showOrderPopup (ionicPopup, newTicket, scope) {
  return ionicPopup.confirm({
    title: 'Voulez-vous commander le billet suivant par SMS?',
    template: '<div>' + newTicket.name + '</br>' + 'Prix: ' + newTicket.price + 'CHF</br>' + 'Code: ' + scope.sms.message +
      '<div>',
    scope: scope,
    buttons: [{
      text: 'Annuler',
      onTap: function (e) {
        return false
      }
    }, {
      text: '<b>Commander</b>',
      type: 'button-dark',
      onTap: function (e) {
        return true
      }
    }]
  })
}

function showAlertPopup (ionicPopup) {
  return ionicPopup.alert({
    title: 'Sélectionner une zone valide!',
    template: 'Une seule zone supplémentaire est autorisée',
    buttons: [{
      text: 'OK',
      type: 'button-dark'
    }]
  })
}

/*
 * Reset the application history cache and go 'home' state
 */
function resetApp (ionicHistory, state) {
  ionicHistory.clearCache()
  ionicHistory.nextViewOptions({
    disableAnimate: true,
    disableBack: true
  })
  state.go('home')
}

var tlSmsApp = angular.module('starter', ['ionic', 'ngCordova'])

tlSmsApp.run(function ($ionicPlatform) {
  $ionicPlatform.ready(function () {
    if (window.cordova && window.cordova.plugins.Keyboard) {
      // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
      // for form inputs)
      cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true)

      // Don't remove this line unless you know what you are doing. It stops the viewport
      // from snapping when text inputs are focused. Ionic handles this internally for
      // a much nicer keyboard experience.
      cordova.plugins.Keyboard.disableScroll(true)
    }
    if (window.StatusBar) {
      StatusBar.styleDefault()
    }
  })
})

tlSmsApp.config(function ($stateProvider, $urlRouterProvider) {
  $stateProvider.state('home', {
    url: '/home',
    templateUrl: 'templates/home.html',
    controller: 'HomeCtrl'
  })
  $stateProvider.state('ticket', {
    url: '/ticket/:id',
    templateUrl: 'templates/ticket.html',
    controller: 'ticketCtrl'
  })
  $stateProvider.state('about', {
    url: '/about',
    templateUrl: 'templates/about.html'
  })
  $urlRouterProvider.otherwise('/home')
})

/**
 * HomeCtrl manage data for the 'home.html' page:
 *  *   $scope.tickets are provided by a ticketsFactory that provide the
 *      'smscode.json' content.
 *  *   $scope.onClickTicket function load the 'ticket' state and create an
 *      order for the specific tickert.
 *
 */
tlSmsApp.controller('HomeCtrl', function ($scope, $state, ticketsFactory, orderService) {
  $scope.tickets = ticketsFactory.getTickets().then(function (tickets) {
    $scope.tickets = tickets
  }, function (msg) {
    window.alert(msg)
    console.log(msg)
  })

  $scope.onClickTicket = function (index, ticket, number, isSpecial) {
    $state.go('ticket', {
      id: index,
      obj: ticket
    })
    orderService.setOrder(ticket, isSpecial, number)
  }
})

/**
 * ticketCtrl is responsable to manage data for the 'ticket.html' page and sending
 * the sms:
 *    *   $scope.order object contains all order informations (ticket info,
 *        special ticket and the destinaton phone number).
 *    *   scope.sms object contains the destination number and the message to
 *        send
 *    *   $scope.onClickOrder function is prepare the the message to send:
 *           - parse zone if provided by the input field - create a sms message
 *                to send
 *           - show the order popup feedback with which user can confirm
 *                or cancel the order.
 */
tlSmsApp.controller('ticketCtrl', function ($scope, $state, $cordovaSms,
  orderService, smsService, $ionicPopup,
  $ionicLoading, $cordovaToast, $ionicHistory) {
  $scope.order = orderService.getOrder()
  if ($scope.order === null) {
    resetApp($ionicHistory, $state)
    return
  }

  $scope.onClickOrder = function (isFullFare, inputText) {
    var newTicket,
      arrayZones,
      alertPopup,
      newCode,
      orderPopup

    if ($scope.order.ticket.needZone) {
      try {
        arrayZones = parseZones(inputText.zones, 1)
      } catch (e) {
        arrayZones = null
      }
    }

    if ($scope.order.isSpecial) {
      newTicket = $scope.order.ticket
    } else {
      newTicket = (isFullFare) ? $scope.order.ticket.Plein : $scope.order.ticket.Reduit
    }
    smsService.createSmsInfo($scope.order.number, newTicket.code)

    // In case of bad parsing we show an alert popup to the user.
    if (arrayZones === null) {
      alertPopup = showAlertPopup($ionicPopup)
      alertPopup.then(function (res) {
        console.log('Bad zones parsing')
      })
    } else {
      $scope.sms = {
        number: smsService.getSmsInfo().number,
        message: smsService.getSmsInfo().code
      }

      console.log('sms:' + $scope.sms.message + ' to ' + $scope.sms.number)

      // If the ticket need zones, we prepare the newCode.
      if ($scope.order.ticket.needZone) {
        newCode = ''
        arrayZones.forEach(function (item) {
          newCode = newCode + ' ' + item
        })
        $scope.sms.message = $scope.sms.message.replace(',', newCode.replace(/ /g, ''))
        console.log('newCode: ' + $scope.sms.message)
      }

      // Display a confirmation popup. If user accepts, then send the SMS.
      orderPopup = showOrderPopup($ionicPopup, newTicket, $scope)
      orderPopup.then(function (res) {
        if (res) {
          // User press Confirm button
          try {
            sendSms($ionicLoading, $scope.sms, $cordovaToast, $state, $cordovaSms, $ionicHistory)
          } catch (e) {
            window.alert(e)
          }
        } else {
          // User press Cancel button
          console.log('User Cancel operation')
        }
      })
    }
  }
})

tlSmsApp.service('smsService', function () {
  var smsInfo,
    createSmsInfo,
    getSmsInfo

  smsInfo = null
  createSmsInfo = function (number, code) {
    smsInfo = {
      number: number,
      code: code
    }
  }
  getSmsInfo = function () {
    return smsInfo
  }

  return {
    createSmsInfo: createSmsInfo,
    getSmsInfo: getSmsInfo
  }
})

tlSmsApp.service('orderService', function () {
  var order,
    setOrder,
    getOrder

  setOrder = function (ticket, isSpecial, number) {
    order = {
      ticket: ticket,
      isSpecial: isSpecial,
      number: number
    }
  }
  getOrder = function () {
    return order
  }

  return {
    setOrder: setOrder,
    getOrder: getOrder
  }
})

tlSmsApp.factory('ticketsFactory', function ($http, $q) {
  var ticketsFactory = {
    tickets: false,
    getTickets: function () {
      var deferred = $q.defer()
      $http.get('smscode.json')
        .success(function (data, status) {
          ticketsFactory.tickets = data
          deferred.resolve(ticketsFactory.tickets)
        }).error(function (data, status) {
          deferred.reject('Impossible de récupérer la liste des tickets disponibles')
        })
      return deferred.promise
    }
  }
  return ticketsFactory
})
