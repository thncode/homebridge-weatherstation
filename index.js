// WeatherStation Core (mrv)

var Service, Characteristic, HomebridgeAPI, UUIDGen, FakeGatoHistoryService;
var inherits = require('util').inherits;
var os = require("os");
var hostname = os.hostname();
const fs = require('fs');
const moment = require('moment');

const readFile = "/root/.homebridge/weatherstation.txt";

var temperature, airPressure, maxWind, avgWind, sunlight, humidity, rain, battery, uv, charging, readtime;

module.exports = function (homebridge) {
	
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    HomebridgeAPI = homebridge;
    UUIDGen = homebridge.hap.uuid;
    FakeGatoHistoryService = require("fakegato-history")(homebridge);

    homebridge.registerAccessory("homebridge-weatherstation", "WeatherStation", WeatherStation);
};


function WeatherStation(log, config) {

    var that = this;
    this.log = log;
    this.name = config.name;
    this.displayName = this.name;
    this.deviceId = config.deviceId;

    this.config = config;

    this.setUpServices();
    
    this.readData();

   	fs.watch(readFile, (event, filename) => {
   		if (event === 'change') this.readData();
   	});
};
    

function batteryLevel() {
	return battery * 100 / 3.7;
}


function chargingState() {
	return charging != 0.0;
}


WeatherStation.prototype.readData = function () {

	var data = fs.readFileSync(readFile, "utf-8");
	var lastSync = Date.parse(data.substring(0, 19));
	if (lastSync == undefined) return;
	if (isNaN(lastSync)) return;
	if (readtime == lastSync) return;
	readtime = lastSync;

	temperature = parseFloat(data.substring(20));
	airPressure = parseFloat(data.substring(25));
	maxWind = parseFloat(data.substring(33));
	avgWind = parseFloat(data.substring(39));
	sunlight = parseInt(data.substring(45));
	humidity = parseFloat(data.substring(52));
	rain = parseFloat(data.substring(55));
	battery = parseFloat(data.substring(58));
	uv = parseFloat(data.substring(63));
	charging = parseFloat(data.substring(66));

	this.log("Data: ", temperature, airPressure, maxWind, avgWind, sunlight, humidity, rain, battery, charging);

	this.fakeGatoHistoryService.addEntry({ time: moment().unix(), temp: temperature, pressure: airPressure, humidity: humidity });

    this.tempService.getCharacteristic(Characteristic.CurrentTemperature).updateValue(temperature, null);
    this.lightService.getCharacteristic(Characteristic.CurrentAmbientLightLevel).updateValue(sunlight, null);
    this.humidityService.getCharacteristic(Characteristic.CurrentRelativeHumidity).updateValue(humidity, null);
    this.batteryService.getCharacteristic(Characteristic.BatteryLevel).updateValue(batteryLevel(), null);
    this.batteryService.getCharacteristic(Characteristic.BatteryLevel).updateValue(charging, null);
};

WeatherStation.prototype.getChargingState = function (callback) {
	var charged = chargingState();
//	this.log("Charging: ", charged);
    return callback(null, charged);
};

WeatherStation.prototype.getFirmwareRevision = function (callback) {
    return callback(null, '1.0');
};

WeatherStation.prototype.getBatteryLevel = function (callback) {
	var battery = batteryLevel();
    return callback(null, battery);
};

WeatherStation.prototype.getStatusActive = function (callback) {
	if (readtime == undefined) return callback(null, false);
	if (isNaN(readtime)) return callback(null, false);
	
	var now = new Date();
	if ((now - readtime) / (1000 * 60) > 60) return callback(null, false);
	
    return callback(null, true);
};

WeatherStation.prototype.getStatusLowBattery = function (callback) {
    return callback(null, battery >= 0.8 ? Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL : Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW);
};

WeatherStation.prototype.getCurrentAmbientLightLevel = function (callback) {
	return callback(null, sunlight);
};

WeatherStation.prototype.getCurrentAvgWind = function (callback) {
	return callback(null, avgWind);
};	

WeatherStation.prototype.getCurrentMaxWind = function (callback) {
	return callback(null, maxWind);
};	

WeatherStation.prototype.getCurrentTemperature = function (callback) {
    return callback(null, temperature);
};

WeatherStation.prototype.getCurrentAirPressure = function (callback) {
    return callback(null, airPressure);
};

WeatherStation.prototype.getCurrentHumidity = function (callback) {
    return callback (null, humidity);
};

WeatherStation.prototype.getCurrentRain = function (callback) {
    return callback (null, rain * 10);
};

WeatherStation.prototype.getCurrentUV = function (callback) {
    return callback (null, uv);
};

WeatherStation.prototype.setUpServices = function () {

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
    this.batteryService.getCharacteristic(Characteristic.ChargingState)
    	.on('get', this.getChargingState.bind(this));
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

    UVSensor = function () {
        Characteristic.call(this, 'UV Index', '05ba0fe0-b848-4226-906d-5b64272e05ce');
        this.setProps({
            format: Characteristic.Formats.UINT8,
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


    this.weatherSensorService = new WeatherSensor('Wind & Regen');

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
