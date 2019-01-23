// WeatherStation

var Service, Characteristic, HomebridgeAPI, FakeGatoHistoryService;
var inherits = require('util').inherits;
var os = require("os");
var hostname = os.hostname();
const fs = require('fs');

var intervalID;

const readFile = "/home/pi/WeatherStation/data.txt";

var temperature;
var airPressure;
var maxWind;
var avgWind;
var sunlight;
var humidity;
var rain;
var battery;
var uv;

var glog;
var ctime;

module.exports = function (homebridge) {
	
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    HomebridgeAPI = homebridge;
    FakeGatoHistoryService = require("fakegato-history")(homebridge);

    homebridge.registerAccessory("homebridge-weatherstation", "WeatherStation", WeatherStation);
};


function read() {
	var data = fs.readFileSync(readFile, "utf-8");
	var lastSync = Date.parse(data.substring(0, 19));
	temperature = parseFloat(data.substring(20));
	airPressure = parseFloat(data.substring(25));
	maxWind = parseFloat(data.substring(34));
	avgWind = parseFloat(data.substring(40));
	sunlight = parseInt(data.substring(46), 10);
	humidity = parseFloat(data.substring(52));
	rain = parseFloat(data.substring(55)) * 10;
	battery = parseFloat(data.substring(57));
	uv = parseFloat(data.substring(62));
}


function WeatherStation(log, config) {
    var that = this;
    this.log = glog = log;
    this.name = config.name;
    this.displayName = this.name;
    this.deviceId = config.deviceId;
    this.interval = Math.min(Math.max(config.interval, 1), 60);

    this.config = config;

    this.storedData = {};

    this.setUpServices();
    
    read();

	intervalID = setInterval(function() {
		
		var stats = fs.statSync(readFile);
		
		var doit = false;
		if (ctime) {
			if (ctime.getTime() != stats.mtime.getTime()) {
				ctime = stats.mtime;
				doit = true;
			}
		}
		else {
			ctime = stats.mtime;
			doit = true;
		}
			
		if (doit) {
			read();
			glog("Data: ", temperature, airPressure, maxWind, avgWind, sunlight, humidity, rain, battery);

			that.fakeGatoHistoryService.addEntry({
				time: new Date().getTime() / 1000,
				temp: temperature,
				pressure: airPressure,
				humidity: humidity
				});
		}
	}, 2000);
};


WeatherStation.prototype.getFirmwareRevision = function (callback) {
    callback(null, '1.0.0');
};

WeatherStation.prototype.getBatteryLevel = function (callback) {
	var perc = (battery - 0.8) * 100;
    callback(null,perc);
};

WeatherStation.prototype.getStatusActive = function (callback) {
    callback(null, true);
};

WeatherStation.prototype.getStatusLowBattery = function (callback) {
	if (battery >= 0.8)
        callback(null, Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
    else
        callback(null, Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW);
};

WeatherStation.prototype.getCurrentAmbientLightLevel = function (callback) {
	callback(null, sunlight);
};

WeatherStation.prototype.getCurrentAvgWind = function (callback) {
	callback(null, avgWind);
};	

WeatherStation.prototype.getCurrentMaxWind = function (callback) {
	callback(null, maxWind);
};	

WeatherStation.prototype.getCurrentTemperature = function (callback) {
    callback(null, temperature);
};

WeatherStation.prototype.getCurrentAirPressure = function (callback) {
    callback(null, airPressure);
};

WeatherStation.prototype.getCurrentHumidity = function (callback) {
    callback (null, humidity);
};

WeatherStation.prototype.getCurrentRain = function (callback) {
    callback (null, rain);
};

WeatherStation.prototype.getCurrentUV = function (callback) {
    callback (null, uv);
};

WeatherStation.prototype.setUpServices = function () {
    // info service
    this.informationService = new Service.AccessoryInformation();

    this.informationService
        .setCharacteristic(Characteristic.Manufacturer, "THN Systems")
        .setCharacteristic(Characteristic.Model, "WeatherStation")
        .setCharacteristic(Characteristic.SerialNumber, hostname + "-" + this.name)
    this.informationService.getCharacteristic(Characteristic.FirmwareRevision)
        .on('get', this.getFirmwareRevision.bind(this));
        
    this.batteryService = new Service.BatteryService(this.name);
    this.batteryService.getCharacteristic(Characteristic.BatteryLevel)
        .on('get', this.getBatteryLevel.bind(this));
    this.batteryService.setCharacteristic(Characteristic.ChargingState, Characteristic.ChargingState.NOT_CHARGEABLE);
    this.batteryService.getCharacteristic(Characteristic.StatusLowBattery)
        .on('get', this.getStatusLowBattery.bind(this));

    this.lightService = new Service.LightSensor("Helligkeitsstufe");
    this.lightService.getCharacteristic(Characteristic.CurrentAmbientLightLevel)
        .on('get', this.getCurrentAmbientLightLevel.bind(this));
    this.lightService.getCharacteristic(Characteristic.StatusLowBattery)
        .on('get', this.getStatusLowBattery.bind(this));
    this.lightService.getCharacteristic(Characteristic.StatusActive)
        .on('get', this.getStatusActive.bind(this));

    this.tempService = new Service.TemperatureSensor("Temperatur");
    this.tempService.getCharacteristic(Characteristic.CurrentTemperature)
		.setProps({minValue: -50})
        .on('get', this.getCurrentTemperature.bind(this));
    this.tempService.getCharacteristic(Characteristic.StatusLowBattery)
        .on('get', this.getStatusLowBattery.bind(this));
    this.tempService.getCharacteristic(Characteristic.StatusActive)
        .on('get', this.getStatusActive.bind(this));

    this.humidityService = new Service.HumiditySensor("Luftfeuchtigkeit");
    this.humidityService.getCharacteristic(Characteristic.CurrentRelativeHumidity)
        .on('get', this.getCurrentHumidity.bind(this));
    this.humidityService.getCharacteristic(Characteristic.StatusLowBattery)
        .on('get', this.getStatusLowBattery.bind(this));
    this.humidityService.getCharacteristic(Characteristic.StatusActive)
        .on('get', this.getStatusActive.bind(this));

    this.fakeGatoHistoryService = new FakeGatoHistoryService("weather", this, { storage: 'fs' });

    var CustomCharacteristic = {};
    
    //airpressure characteristic
    CustomCharacteristic.AirPressure = function () {
		Characteristic.call(this, 'Air Pressure', 'E863F10F-079E-48FF-8F27-9C2605A29F52');
        this.setProps({
            format: Characteristic.Formats.UINT16,
            unit: "hPa",
            maxValue: 1100,
            minValue: 700,
            minStep: 1,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    };
    inherits(CustomCharacteristic.AirPressure, Characteristic);
    
    CustomCharacteristic.AirPressure.UUID = 'E863F10F-079E-48FF-8F27-9C2605A29F52';


	// avg wind characteristic
	CustomCharacteristic.avgWind = function () {
		Characteristic.call(this, 'Windgeschwindigkeit', '49C8AE5A-A3A5-41AB-BF1F-12D5654F9F41');
		this.setProps({
			format: Characteristic.Formats.FLOAT,
			unit: "km/h",
			maxValue: 100,
			minValue: 0,
			minStep: 0.1,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
	};
    inherits(CustomCharacteristic.avgWind, Characteristic);

    CustomCharacteristic.avgWind.UUID = '49C8AE5A-A3A5-41AB-BF1F-12D5654F9F41';


	// max wind characteristic
	CustomCharacteristic.maxWind = function () {
		Characteristic.call(this, 'max. Windböen', '1b3d4324-9d68-11e8-9d55-f7a461994af7');
		this.setProps({
			format: Characteristic.Formats.FLOAT,
			unit: "km/h",
			maxValue: 100,
			minValue: 0,
			minStep: 0.1,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
	};
    inherits(CustomCharacteristic.maxWind, Characteristic);

    CustomCharacteristic.maxWind.UUID = '1b3d4324-9d68-11e8-9d55-f7a461994af7';


    // rain characteristic
    Rain = function () {
        Characteristic.call(this, 'Regen', '10c88f40-7ec4-478c-8d5a-bd0c3cce14b7');
        this.setProps({
            format: Characteristic.Formats.UINT8,
            unit: Characteristic.Units.PERCENTAGE,
            maxValue: 100,
            minValue: 0,
            minStep: 0.1,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    };

    inherits(Rain, Characteristic);

    Rain.UUID = '10c88f40-7ec4-478c-8d5a-bd0c3cce14b7';

    // UV characteristic
    UVSensor = function () {
        Characteristic.call(this, 'UV Index', '05ba0fe0-b848-4226-906d-5b64272e05ce');
        this.setProps({
            format: Characteristic.Formats.UINT8,
            //unit: Characteristic.Units.PERCENTAGE,
            maxValue: 100,
            minValue: 0,
            minStep: 0.1,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    };

    inherits(UVSensor, Characteristic);

    UVSensor.UUID = '05ba0fe0-b848-4226-906d-5b64272e05ce';

    // Weather sensor
    WeatherSensor = function (displayName, subtype) {
        Service.call(this, displayName, '3C233958-B5C4-4218-A0CD-60B8B971AA0A', subtype);

        this.addCharacteristic(Rain);
        this.addOptionalCharacteristic(Characteristic.CurrentTemperature);
    };

    inherits(WeatherSensor, Service);

    WeatherSensor.UUID = '3C233958-B5C4-4218-A0CD-60B8B971AA0A';


    this.weatherSensorService = new WeatherSensor('Wind');

    this.weatherSensorService.getCharacteristic(CustomCharacteristic.avgWind)
		.on('get', this.getCurrentAvgWind.bind(this));
    
    this.weatherSensorService.getCharacteristic(CustomCharacteristic.maxWind)
		.on('get', this.getCurrentMaxWind.bind(this));
     
    this.weatherSensorService.getCharacteristic(Rain)
        .on('get', this.getCurrentRain.bind(this));
       
    this.weatherSensorService.getCharacteristic(CustomCharacteristic.AirPressure)
		.on('get', this.getCurrentAirPressure.bind(this));
		
    this.weatherSensorService.getCharacteristic(UVSensor)
        .on('get', this.getCurrentUV.bind(this));
};


WeatherStation.prototype.getServices = function () {
    var services = [this.informationService, this.batteryService, this.lightService, this.tempService, 
					this.humidityService, this.weatherSensorService, this.fakeGatoHistoryService];
    return services;
};
