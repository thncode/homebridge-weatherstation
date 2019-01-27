//

//#include <stdlib.h>
#include <cstdlib>
#include <iostream>
#include <sstream>
#include <string>
#include <RF24/RF24.h>
#include <unistd.h>

using namespace std;

RF24 radio(RPI_BPLUS_GPIO_J8_15,RPI_BPLUS_GPIO_J8_24, BCM2835_SPI_SPEED_8MHZ);

// Radio pipe addresses for the 2 nodes to communicate.
const uint64_t addresses[4] = { 0xE6E6E6E6E6E6E6E6, 0x544D52687C, 0xE6E6E6E6C6, 0xE6E6E6E6A6 };

uint32_t data[128];
unsigned long startTime, stopTime, counter, rxTimer=0;

FILE *file1;
const char *filename1 = "/home/pi/WeatherStation/data.txt";
FILE *file2;
const char *filename2 = "/home/pi/WeatherStation/airquality.txt";


int main(int argc, char** argv){

  cout << "Home System Receiver V1.2\n";
  
  //int payload_size = 32;

  radio.begin();
  radio.setChannel(102);
  radio.setPALevel(RF24_PA_MAX);
  radio.setDataRate(RF24_250KBPS);
  radio.setAutoAck(true);                 // Ensure autoACK is enabled
  radio.enableDynamicPayloads();
  
  radio.setRetries(5,15);                  // Optionally, increase the delay between retries & # of retries
  radio.setCRCLength(RF24_CRC_16);         // Use 8-bit CRC for performance
  radio.setPALevel(RF24_PA_MAX);

  if (argc > 1)
  {  
	radio.printDetails();
  }

  radio.openReadingPipe(1, addresses[0]);
  radio.openReadingPipe(2, addresses[2]);
  radio.openReadingPipe(3, addresses[3]);
  radio.startListening();

  while (1) {
    
    //uint8_t len = 0;
    uint8_t pipe;

    while(radio.available(&pipe)) {
      //len = radio.getDynamicPayloadSize();
      radio.read(&data,128);
      counter++;
    }
    
     
   if (millis() - rxTimer > 1000) {
     rxTimer = millis();
     
     if (counter)
     {
       timeval curTime;
       gettimeofday(&curTime, NULL);
       char TimeString[136];
       strftime(TimeString, 80, "%Y-%m-%d %H:%M:%S", localtime(&curTime.tv_sec));
       
       if (pipe == 1) { 
	 
	 int32_t data1 = data[0];

	 float temp = float(data1) / 100;
	 float pressure = float(data[1]) / 100;
	 float maxWind =  float(data[2]) / 10;
	 float avgWind =  float(data[3]) / 10;
	 float battery =  float(data[4]) / 100;
	 float moist =    float(data[5]);
	 float rain =     float(data[6]);
	 float light =    float(data[7]);
	 
	 float UV = rain / 1000;
	 float uv1000 = (int)UV * 1000;
	 rain = rain - uv1000;
	 
	 if (battery && battery < 5) {
	    printf("%s [Wetterstation] Temp=%3.1f°C Luftdruck=%4.2fhPa max Wind=%3.1fkm/h avg Wind=%3.1fkm/h Licht=%.0flux Feuchte=%2.0f%% Regen=%1.0f UV=%1.0f Batterie=%1.2fVolt \n\r", 
		    TimeString, temp, pressure, maxWind, avgWind, light, moist, rain, UV, battery);
	    }
	 else 
	    printf("ERROR\n\r");
		
	 file1 = fopen(filename1, "wb");
	 if (file1) {
	   fwrite(TimeString, sizeof(unsigned char), 19, file1);
	   char buffer[50];
	   sprintf(buffer, " %02.2f %07.2f %05.1f %05.1f %06.0f %02.0f %1.0f %04.2f %1.0f", temp, pressure, maxWind, avgWind, light, moist, rain, battery, UV);
	   fwrite(buffer, sizeof(unsigned char), 45, file1);
	   fclose(file1);
	   file1 = NULL;
	 }
	 
      }
      else if (pipe == 2) {
	
	float moist = float(data[0]);
	float temp = float(data[1]) / 100;
	float batt = float(data[2]) / 100;
	
	printf("%s [Weinschrank] Temp=%3.1f°C Feuchte=%2.0f%% Batterie=%1.2fV\n\r", TimeString, temp, moist, batt);
      }
      else if (pipe == 3) {
	
	float ppm25 = float(data[0]) / 100;
	float ppm10 = float(data[1]) / 100;
	float batt = float(data[2]) / 100;
	float charge = float(data[3]) / 100;
	float probes = float(data[4]);
	
	printf("%s [Feinstaub] PPM25=%3.1f PPM10=%3.1f Batterie=%1.2fV Charge=%1.2fV Probes=%02.0f\n\r", TimeString, ppm25, ppm10, batt, charge, probes);
	
	 file2 = fopen(filename2, "wb");
	 if (file2) {
	   fwrite(TimeString, sizeof(unsigned char), 19, file2);
	   char buffer[50];
	   sprintf(buffer, " %05.1f %05.1f %04.2f", ppm25, ppm10, batt);
	   fwrite(buffer, sizeof(unsigned char), 45, file2);
	   fclose(file2);
	   file2 = NULL;
	 }
      }
    }
    counter = 0;
   }

}
}
