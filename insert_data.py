import json
import psycopg2
import os

# Load JSON data from file
with open('data.json') as f:
    data = json.load(f)

# Database connection parameters (use environment variables for security)
conn_params = {
    'dbname': os.getenv('DB_NAME'),
    'user': os.getenv('DB_USER'),
    'password': os.getenv('DB_PASSWORD'),
    'host': os.getenv('DB_HOST'),
    'port': os.getenv('DB_PORT')
}

# Connect to PostgreSQL
conn = psycopg2.connect(**conn_params)
cursor = conn.cursor()

# Insert data into table
insert_rental_query = '''
INSERT INTO rentals (id, start_place_id, end_place_id, start_time, end_time, bike)
VALUES (%s, %s, %s, %s, %s, %s)
ON CONFLICT (id) DO NOTHING;
'''

insert_place_query = '''
INSERT INTO places (id, name, coordinates, type)
VALUES (%s, %s, POINT(%s, %s), %s)
ON CONFLICT (id) DO NOTHING;
'''

for record in data:
    cursor.execute(insert_rental_query, (
        record['id'],
        record['start_place'],
        record['end_place'],
        psycopg2.TimestampFromTicks(record['start_time']),
        psycopg2.TimestampFromTicks(record['end_time']),
        record['bike']
    ))

    cursor.execute(insert_place_query, (
        record['start_place'],
        record['start_place_name'],
        record['start_place_lat'],
        record['start_place_lng'],
        record['start_place_type']
    ))

    cursor.execute(insert_place_query, (
        record['end_place'],
        record['end_place_name'],
        record['end_place_lat'],
        record['end_place_lng'],
        record['end_place_type']
    ))

# Commit changes and close connection
conn.commit()
cursor.close()
conn.close()

print("Data inserted successfully.")
