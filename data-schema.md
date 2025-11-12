table-schema:

```json
{
  "AttributeDefinitions": [
    {
      "AttributeName": "start_time",
      "AttributeType": "N"
    },
    {
      "AttributeName": "device_id",
      "AttributeType": "S"
    },
    {
      "AttributeName": "id",
      "AttributeType": "S"
    }
  ],
  "TableName": "device.trip_history",
  "KeySchema": [
    {
      "AttributeName": "id",
      "KeyType": "HASH"
    }
  ],
  "TableStatus": "ACTIVE",
  "CreationDateTime": "2025-06-23T10:05:19.505Z",
  "ProvisionedThroughput": {
    "LastIncreaseDateTime": "1970-01-01T00:00:00.000Z",
    "LastDecreaseDateTime": "1970-01-01T00:00:00.000Z",
    "NumberOfDecreasesToday": 0,
    "ReadCapacityUnits": 1,
    "WriteCapacityUnits": 1
  },
  "TableSizeBytes": 10092,
  "ItemCount": 6,
  "TableArn": "arn:aws:dynamodb:us-east-1:000000000000:table/device.trip_history",
  "TableId": "2ac5154c-7519-44fb-be68-a475a111030e",
  "GlobalSecondaryIndexes": [
    {
      "IndexName": "gsi.device_id-start_time",
      "KeySchema": [
        {
          "AttributeName": "device_id",
          "KeyType": "HASH"
        },
        {
          "AttributeName": "start_time",
          "KeyType": "RANGE"
        }
      ],
      "Projection": {
        "ProjectionType": "ALL"
      },
      "IndexStatus": "ACTIVE",
      "ProvisionedThroughput": {
        "ReadCapacityUnits": 1,
        "WriteCapacityUnits": 1
      },
      "IndexSizeBytes": 10092,
      "ItemCount": 6,
      "IndexArn": "arn:aws:dynamodb:ddblocal:000000000000:table/device.trip_history/index/gsi.device_id-start_time"
    }
  ],
  "Replicas": [],
  "DeletionProtectionEnabled": true
}
```

```json
{
  "last_position": {
    "acceleration": 94,
    "altitude": 95,
    "lng": 42.213058787873,
    "roll": 99,
    "loctime": 1760700024765,
    "pitch": 23,
    "g_sensor": [
      14,
      74,
      28
    ],
    "lat": 57.20040138454687,
    "speed": 82,
    "direction": 55
  },
  "device_id": "D22472C05B5C28A74CE807228AFFC3EBD7CF0D74",
  "end_time": 1760700024765,
  "created_at": 1760950533716,
  "max_speed": 100,
  "points": [
    {
      "lng": 13.02861553617701,
      "lat": 50.8085842925003,
      "speed": 86,
      "direction": 0,
      "loctime": 1760700024765
    },
    {
      "lng": 86.0622600293772,
      "lat": 10.755443879821666,
      "speed": 20,
      "direction": 1,
      "loctime": 1760700034766
    },
    ...
  ],
  "simplified_points": [
    {
      "lng": 13.02861553617701,
      "lat": 50.8085842925003,
      "speed": 86,
      "direction": 0,
      "loctime": 1760700024765
    },
    {
      "lng": 86.0622600293772,
      "lat": 10.755443879821666,
      "speed": 20,
      "direction": 1,
      "loctime": 1760700034766
    },
    ...
  ],
  "start_time": 1760800024706,
  "uid": "94e5bd80-5931-4ca9-bbb2-50f0b8add37c",
  "deleted": true,
  "id": "2784916FC26444d08cD3Be6689458e5c",
  "last_part_id": 0,
  "modified_at": 1760950644453,
  "average_speed": 30505225874.56,
  "mileage": 499946757.3886852,
  "status": "FINISH"
}
```
