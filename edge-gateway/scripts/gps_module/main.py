import serial

ser = serial.Serial('COM5', 115200, timeout=1)

print("Reading GPS raw data...")

while True:
    line = ser.readline().decode(errors='ignore').strip()
    if line:
        print(line)