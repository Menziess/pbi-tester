# [pbi-testing](/README.md)

Special thanks to [DavidMagarMS's](https://github.com/microsoft/PowerBI-Tools-For-Capacities/commits?author=DavidMagarMS) - [microsoft/PowerBI-Tools-For-Capacities](https://github.com/microsoft/PowerBI-Tools-For-Capacities).

A nodejs server that serves a powerbi dashboard, and keeps refreshing it, sending back metrics to the server via websockets.

<img src="res/testing-powerbi-reports.PNG" alt="Testing PowerBI reports overview" width="750"/>

This project contains all required components for setting up a "realistic" stress test for a single PowerBI report, where the report can be loaded by many workers by browsing to a webpage that is hosted by a nodejs webserver that requires a single token. The workers can be replicated as containers in a kubernetes cluster, as Azure Container Instances, or simply by human beings opening browser tabs. The data is stored as lines of json, containing (average) refresh times, timestamps, and browser tab id's.

## 1. Development

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
    make deploy-server
    ```

## 2. Server Usage

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
4. You can now update the token, by browsing to: `http://pbi-tester.westeurope.azurecontainer.io/set?token={"PBIToken":"secret"}`, replacing the "secret" with the value of your generated token
5. You'll be able to update the report also: `http://pbi-tester.westeurope.azurecontainer.io/set?report=...`
6. Now, you'll be able to visit the page in multiple browser tabs, and proceed the concurrency testing

## 3. Server Metrics Logging

The metrics are logged to a file in [`logs/log.json`](logs/log.json) into your storage account:

```json
{"tabId":"05d45e65-789b","loadCounter":1,"avgDuration":3.066,"currDuration":3.066,"thinkTimeSeconds":1,"timeStamp":"2020-06-30T13:54:57.750Z"},
{"tabId":"05d45e65-789b","loadCounter":2,"avgDuration":2.401,"currDuration":1.736,"thinkTimeSeconds":1,"timeStamp":"2020-06-30T13:55:00.485Z"},
```

## 4. Client Usage

A container has been developed that -- on startup -- opens a firefox tab with url `http://pbi-tester.westeurope.azurecontainer.io`.

1. Make sure that the server has an [active token](#2.%20Server%20Usage)
2. Create one or multiple containers using container instances, a kubernetes cluster `make deploy-client`, or run locally: `make run-client`
3. Monitor the CPU / memory / network usage to simulate typical browser tabs for the stress test

## Improvements

- Making the url configurable for the `menziess/pbi-tab` container
- Starting multiple tabs per `pbi-tab` container
- Using Web Workers to prevent background tabs to become idle
- Improve script for tabs to wait until server becomes available so that a restart is not required
- Improve kubernetes deployment for performance reasons
