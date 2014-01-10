/*

 Built by
   __                   ____
  / /___  ______  ___  / __/___  ____
 / __/ / / / __ \/ _ \/ /_/ __ \/ __ \
/ /_/ /_/ / /_/ /  __/ __/ /_/ / /_/ /
\__/\__, / .___/\___/_/  \____/\____/
 /____/_/
 */

var https = require('https');
var extend = require('extend');
var builder = require('xmlbuilder');
var parser = require('xml2json');

function UPS(args) {
  var hosts = {
      sandbox: 'wwwcie.ups.com',
      live: 'onlinetools.ups.com'
    },
    defaults = {
      imperial: true, // for inches/lbs, false for metric cm/kgs
      currency: 'USD',
      environment: 'sandbox',
      access_key: '',
      username: '',
      password: '',
      pretty: false,
      user_agent: 'uh-sem-blee, Co | typefoo'
    },
    pickup_codes = {
      'daily_pickup': '01',
      'customer_counter': '03',
      'one_time_pickup': '06',
      'on_call_air': '07',
      'suggested_retail_rates': '11',
      'letter_center': '19',
      'air_service_center': '20'
    },
    customer_classifications = {
      'wholesale': '01',
      'occasional': '03',
      'retail': '04'
    },
    default_services = {
      '01': 'UPS Next Day Air',
      '02': 'UPS Second Day Air',
      '03': 'UPS Ground',
      '07': 'UPS Worldwide Express',
      '08': 'UPS Worldwide Expedited',
      '11': 'UPS Standard',
      '12': 'UPS Three-Day Select',
      '13': 'UPS Next Day Air Saver',
      '14': 'UPS Next Day Air Early A.M.',
      '54': 'UPS Worldwide Express Plus',
      '59': 'UPS Second Day Air A.M.',
      '65': 'UPS Saver',
      '82': 'UPS Today Standard',
      '83': 'UPS Today Dedicated Courier',
      '84': 'UPS Today Intercity',
      '85': 'UPS Today Express',
      '86': 'UPS Today Express Saver'
    },
    canada_origin_services = {
      '01': 'UPS Express',
      '02': 'UPS Expedited',
      '14': 'UPS Express Early A.M.'
    },
    mexico_origin_services = {
      '07': 'UPS Express',
      '08': 'UPS Expedited',
      '54': 'UPS Express Plus'
    },
    eu_origin_services = {
      '07': 'UPS Express',
      '08': 'UPS Expedited'
    },
    other_non_us_origin_services = {
      '07': 'UPS Express'
    },
    tracking_status_codes = {
      'I': 'In Transit',
      'D': 'Delivered',
      'X': 'Exception',
      'P': 'Pickup',
      'M': 'Manifest Pickup'
    },
    eu_country_codes = ['GB', 'AT', 'BE', 'BG', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'],
    us_territories_treated_as_countries = ['AS', 'FM', 'GU', 'MH', 'MP', 'PW', 'PR', 'VI'],
    $scope = this;

  $scope.options = defaults;

  function buildAddress(data) {
    var address = {
      'AddressLine1': data.address_line_1 || '',
      'AddressLine2': data.address_line_2 || '',
      'AddressLine3': data.address_line_3 || '',
      'City': data.city || '',
      'StateProvinceCode': data.state_code || '',
      'PostalCode': data.postal_code || '',
      'CountryCode': data.country_code || ''
    };

    if(data.residential) {
      address.ResidentialAddressIndicator = true;
    }

    return address;
  }

  function buildShipment(data) {
    data.shipper = data.shipper || {address: {}};
    data.ship_to = data.ship_to || {address: {}};
    data.packages = data.packages || [{}];
    var shipment = {
      'Shipper': {
        'Name': data.shipper.company_name || (data.shipper.name || ''),
        'PhoneNumber': data.shipper.phone_number || '',
        'ShipperNumber': data.shipper.shipper_number || '',
        'Address': buildAddress(data.shipper.address)
      },
      'ShipTo': {
        'Name': data.ship_to.name || '',
        'CompanyName': data.ship_to.company_name || '',
        'AttentionName': data.ship_to.attention_name || (data.ship_to.company_name || ''),
        'PhoneNumber': data.ship_to.phone_number || '',
        'Address': buildAddress(data.ship_to.address)
      }
    };

    if(data.ship_from) {
      shipment.ShipFrom = {
        'Name': data.ship_from.name || '',
        'PhoneNumber': data.ship_from.phone_number || '',
        'Address': buildAddress(data.ship_from.address)
      }
    }

    shipment['#list'] = [];

    for(var i = 0; i < data.packages.length; i++) {
      var p = { 'Package': {
        'PackagingType': {
          'Code': '02'
        },
        'PackageWeight': {
          'Weight': data.packages[i].weight || '',
          'UnitOfMeasurement': {
            'Code': $scope.options.imperial ? 'LBS' : 'KGS'
          }
        }
      }};

      if(data.packages[i].description) {
        p['Package']['Description'] = data.packages[i].description;
      }

      if(data.packages[i].dimensions) {
        p['Package']['Dimensions'] = {
          'Length': data.packages[i].dimensions.length || '1',
          'Width': data.packages[i].dimensions.width || '1',
          'Height': data.packages[i].dimensions.height || '1',
          'UnitOfMeasurement': $scope.options.imperial ? 'IN' : 'CM'
        };
      }

      if(data.packages[i].insured_value) {
        if(!p['Package']['PackageServiceOptions']) {
          p['Package']['PackageServiceOptions'] = {};
        }
        p['Package']['PackageServiceOptions']['InsuredValue'] = {
          'CurrencyCode': $scope.options.currency,
          'MonetaryValue': data.packages[i].insured_valued || '1'
        };
      }

      if(data.packages[i].delivery_confirmation_type) {
        if(!p['Package']['PackageServiceOptions']) {
          p['Package']['PackageServiceOptions'] = {};
        }
        p['Package']['PackageServiceOptions']['DeliveryConfirmation'] = {
          'DCISType': data.packages[i].delivery_confirmation_type || '2'
        };
      }

      shipment['#list'].push(p);
    };

    return shipment;
  }

  function buildPaymentInformation(data, options) {
    data.shipper = data.shipper || {address: {}};
    var payment = {
      'Prepaid': {
        'BillShipper': {
          'AccountNumber': data.shipper.shipper_number || ''
        }
      }
    };

    return payment;
  }

  function buildLabelSpecification(data, options) {
    var label = {
      'LabelPrintMethod': {
        'Code': 'GIF'
      },
      'HTTPUserAgent': $scope.options.user_agent,
      'LabelImageFormat': {
        'Code': 'GIF'
      }
    };

    return label;
  }

  $scope.config = function(args) {
    $scope.options = extend(defaults, args);
    return $scope;
  };

  $scope.buildAccessRequest = function(data, options) {
    var root = builder.create('AccessRequest', {headless: true});
    root.att('xml:lang', 'en-US');
    root.ele('UserId', $scope.options.username);
    root.ele('Password', $scope.options.password);
    root.ele('AccessLicenseNumber', $scope.options.access_key);
    return root.end({pretty: $scope.options.pretty});
  };

  $scope.buildRatesRequest = function(data, options) {
    if(!data) {
      data = {};
    }
    data.pickup_type = data.pickup_type || 'daily_pickup';
    var root = builder.create('RatingServiceSelectionRequest', {headless: true});
    var request = {
      'Request': {
        'RequestAction': 'Rate',
        'RequestOption': 'Shop'
      },
      'PickupType': {
        'Code': pickup_codes[data.pickup_type]
      },
      'CustomerClassification': {
        'Code': '00'
      }
    };

    request['Shipment'] = buildShipment(data);

    root.ele(request);
    return root.end({pretty: $scope.options.pretty});
  };

  $scope.handleRatesResponse = function(json, callback) {
    if(json.RatingServiceSelectionResponse.Response.ResponseStatusCode !== 1) {
      return callback(json.RatingServiceSelectionResponse.Response.Error, null);
    }
    callback(null, json.RatingServiceSelectionResponse);
  };

  $scope.buildTrackingRequest = function(tracking_number, options) {
    var root = builder.create('TrackRequest', {headless: true});
    var request = {
      'Request': {
        'RequestAction': 'Track',
        'RequestOption': '1'
      },
      'TrackingNumber': tracking_number
    };

    root.ele(request);
    return root.end({pretty: $scope.options.pretty});
  };

  $scope.handleTrackingResponse = function(json, callback) {
    if(json.TrackResponse.Response.ResponseStatusCode !== 1) {
      return callback(json.TrackResponse.Response.Error, null);
    }
    return callback(null, json.TrackResponse);
  };

  $scope.buildShipmentConfirmRequest = function(data, options) {
    if(!data) {
      data = {};
    }
    data.pickup_type = data.pickup_type || 'daily_pickup';
    var root = builder.create('ShipmentConfirmRequest', {headless: true});
    var request = {
      'Request': {
        'RequestAction': 'ShipConfirm',
        'RequestOption': 'nonvalidate'
      },
      'PickupType': {
        'Code': pickup_codes[data.pickup_type]
      },
      'CustomerClassification': {
        'Code': '00'
      },
      'LabelSpecification': buildLabelSpecification(data, options)
    };

    request['Shipment'] = buildShipment(data);
    request['Shipment']['Service'] = {
      'Code': data.service_code || '03',
      'Description': default_services[data.service_code] || default_services['03']
    };
    request['Shipment']['PaymentInformation'] = buildPaymentInformation(data, options);

    root.ele(request);
    return root.end({pretty: $scope.options.pretty});
  };

  $scope.handleShipmentConfirmResponse = function(json, callback) {
    if(json.ShipmentConfirmResponse.Response.ResponseStatusCode !== 1) {
      return callback(json.ShipmentConfirmResponse.Response.Error, null);
    }
    return callback(null, json.ShipmentConfirmResponse);
  };

  $scope.buildShipmentAcceptRequest = function(data, options) {
    var root = builder.create('ShipmentAcceptRequest', {headless: true});
    var request = {
      'Request': {
        'RequestAction': 'ShipAccept'
      },
      'ShipmentDigest': data.shipment_digest
    };

    root.ele(request);
    return root.end({pretty: $scope.options.pretty});
  };

  $scope.handleShipmentAcceptResponse = function(json, callback) {
    if(json.ShipmentAcceptResponse.Response.ResponseStatusCode !== 1) {
      return callback(json.ShipmentAcceptResponse.Response.Error, null);
    }
    return callback(null, json.ShipmentAcceptResponse);
  };

  $scope.buildVoidShipmentRequest = function(data, options) {
    var root = builder.create('VoidShipmentRequest', {headless: true});
    var request = {
      'Request': {
        'RequestAction': '1',
        'RequestOption': '1'
      },
      'ShipmentIdentificationNumber': data.shipment_identification_number
    };

    root.ele(request);
    return root.end({pretty: $scope.options.pretty});
  };

  $scope.handleVoidShipmentResponse = function(json, callback) {
    if(json.VoidShipmentResponse.Response.ResponseStatusCode !== 1) {
      return callback(json.VoidShipmentResponse.Response.Error, null);
    }
    return callback(null, json.VoidShipmentResponse);
  };

  var resources = {
    rates: { p: '/ups.app/xml/Rate', f: $scope.buildRatesRequest, r: $scope.handleRatesResponse },
    track: { p: '/ups.app/xml/Track', f: $scope.buildTrackingRequest, r: $scope.handleTrackingResponse },
    confirm: { p: '/ups.app/xml/ShipConfirm', f: $scope.buildShipmentConfirmRequest, r: $scope.handleShipmentConfirmResponse },
    accept: { p: '/ups.app/xml/ShipAccept', f: $scope.buildShipmentAcceptRequest, r: $scope.handleShipmentAcceptResponse },
    void: { p: '/ups.app/xml/Void', f: $scope.buildVoidShipmentRequest, r: $scope.handleVoidShipmentResponse }
  };

  function buildResourceFunction(i, resources) {
    return function(data, options, callback) {
      if(!callback) {
        callback = options;
        options = undefined;
      }
      var authorize = $scope.buildAccessRequest(data, options);
      var callBody = resources[i].f(data, options);
      var body = '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>\n' + authorize + callBody;
      console.log(body);
      var req = https.request({
        host: hosts[$scope.options.environment],
        path: resources[i].p,
        method: 'POST',
        headers: {
          'Content-Length': body.length,
          'Content-Type': 'text/xml'
        }
      });

      req.write(body);
      req.on('error', function(e) {
        return callback(e, null);
      });
      req.on('response', function(res) {
        var responseData = '';

        res.on('data', function(data) {
          data = data.toString();
          responseData += data;
        });

        res.on('end', function() {
          try {
            var jsonString = parser.toJson(responseData);
            var json = JSON.parse(jsonString);
          } catch(e) {
            return callback('Invalid JSON', null);
          }

          return resources[i].r(json, callback);
        });
      });
      req.end();
    }
  }

  for(var i in resources) {
    $scope[i] = buildResourceFunction(i, resources);
  }

  return $scope.config(args);
}

module.exports = UPS;