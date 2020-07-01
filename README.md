# [pbi-testing](/README.md)

Special thanks to [DavidMagarMS's](https://github.com/microsoft/PowerBI-Tools-For-Capacities/commits?author=DavidMagarMS) - [microsoft/PowerBI-Tools-For-Capacities](https://github.com/microsoft/PowerBI-Tools-For-Capacities).

A nodejs server that serves a powerbi dashboard, and keeps refreshing it, sending back metrics to the server via websockets.

## Development

The [`Makefile`](Makefile) contains all required commands for building, publishing and deploying to Azure Container Instances.

1. Run `make install` (requires `yarn` and `node`)
2. Start the server:
    ```bash
    export PORT=3000
    make dev
    ```
    or on Windows:
    ```cmd
    set PORT=3000
    node src/server.js
    ```
3. Repeat step 2 after changing any server-side code.
   Simply refresh your browser tab (using `CTRL + SHIFT + R`) when you're only modifying client-side code.
4. Dockerize your changes (requires docker)
    ```bash
    make dockerize
    ```
5. Spin up a container to see whether it functions
    ```bash
    make run
    ```
6. Push the changes to a docker registry
    ```bash
    make publish
    ```
7. Deploy your image to ACI (Azure Container Instances)
    ```bash
    make deploy
    ```

## Usage

A token (that expires after 60 minutes) is required, which can be generated using the [`token.ps1`](token.ps1) powershell script.

1. Generate a token:
    ```bash
    make generate-token
    ```
    or on Windows:
    ```bash
    powershell ./token.ps1
    ```
2. Deploy the solution, following the steps in [Development](#development)
3. Depending on the `NAME` variable in the [`Makefile`](Makefile), you should be able to visit your powerbi tester page: http://pbi-tester.westeurope.azurecontainer.io
4. You can now update the [`private/PBIToken.json`](https://github.com/microsoft/PowerBI-Tools-For-Capacities/blob/master/RealisticLoadTestTool/PBIToken.json), by browsing to: `http://pbi-tester.westeurope.azurecontainer.io/set?token={"PBIToken":"secret"}`, replacing the "secret" with the value of your generated token
5. You'll be able to update the [`public/PBIReport.json`](https://github.com/microsoft/PowerBI-Tools-For-Capacities/blob/master/RealisticLoadTestTool/PBIReport.json) also: `http://pbi-tester.westeurope.azurecontainer.io/set?report=...`
6. Finally, you'll be able to visit the page in multiple browser tabs, and proceed the concurrency testing

More information about the internals of the report webpage can be found in the orignal repository: https://github.com/microsoft/PowerBI-Tools-For-Capacities/tree/master/RealisticLoadTestTool

## Metrics

The metrics are logged to a file in [`logs/log.json`](logs/log.json) into your storage account:

```json
{"tabId":"05d45e65-789b","loadCounter":1,"avgDuration":3.066,"currDuration":3.066,"thinkTimeSeconds":1,"timeStamp":"2020-06-30T13:54:57.750Z"},
{"tabId":"05d45e65-789b","loadCounter":2,"avgDuration":2.401,"currDuration":1.736,"thinkTimeSeconds":1,"timeStamp":"2020-06-30T13:55:00.485Z"},
```
