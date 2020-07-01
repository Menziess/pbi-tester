function s4() {
  return Math.floor((1 + Math.random()) * 0x10000)
    .toString(16)
    .substring(1);
}

function guid() {
  return s4() + s4() + '-' + s4();
}

var socket = io({ transports: ['websocket'] });
var startTime = new Date();
var id = guid();

socket.on('config', data => {
  var token = data.token;
  var PBIEtoken = token.PBIToken;

  var reportParameters = data.report;
  var embedUrl = reportParameters.reportUrl;
  var filterStart = reportParameters.filterStart;
  var filterMax = reportParameters.filterMax;
  var filterValue = filterStart;

  var filtersList = Array(0);
  if (reportParameters.filters != undefined) {
    var arrFilterCounter = Array(reportParameters.filters.length);
    var filterCombinations = 1;
    for (var i = 0; i < reportParameters.filters.length; i++) {
      filterCombinations = filterCombinations * reportParameters.filters[i].filtersList.length;
      arrFilterCounter[i] = 0;
    }

    filtersList = Array(filterCombinations);
    for (var i = 0; i < filterCombinations; i++) {
      filtersList[i] = {
        slicers: [],
        filters: []
      };
      for (var j = 0; j < reportParameters.filters.length; j++) {
        var v = reportParameters.filters[j].filtersList[arrFilterCounter[j]];

        var filter = {
          $schema: "http://powerbi.com/product/schema#basic",
          target: {
            table: reportParameters.filters[j].filterTable,
            column: reportParameters.filters[j].filterColumn
          },
          operator: "In",
          values: (v != null ? (Array.isArray(v) ? v : [v]) : reportParameters.filters[j].filtersList.filter(function (a) { return a != null; })),
          filterType: 1
        };

        var slicer =
        {
          selector: {
            $schema: "http://powerbi.com/product/schema#slicerTargetSelector",
            target: {
              table: reportParameters.filters[j].filterTable,
              column: reportParameters.filters[j].filterColumn
            }
          },
          state: {
            filters: [
              {
                $schema: "http://powerbi.com/product/schema#basic",
                target: {
                  table: reportParameters.filters[j].filterTable,
                  column: reportParameters.filters[j].filterColumn
                },
                operator: "In",
                values: (v != null ? (Array.isArray(v) ? v : [v]) : reportParameters.filters[j].filtersList.filter(function (a) { return a != null; }))
              }
            ]
          }
        };

        if (reportParameters.filters[j].isSlicer)
          filtersList[i].slicers.push(slicer);
        else
          filtersList[i].filters.push(filter);


      }
      for (var z = reportParameters.filters.length - 1; z >= 0; z--) {
        if (arrFilterCounter[z] + 1 < reportParameters.filters[z].filtersList.length) {
          arrFilterCounter[z]++;
          z = -1;
        }
        else {
          arrFilterCounter[z] = 0;
        }
      }
    }
  }

  var filtersCount = filterMax - filterStart;
  if (filtersList != null) {
    filterStart = 0;
    filterMax = filtersList.length;
    filtersCount = filterMax;
    shuffleArray(filtersList);
  }

  var bookmarkList = reportParameters.bookmarkList;
  if (bookmarkList == null || bookmarkList == undefined || bookmarkList == "") {
    bookmarkList = [""];
  }

  var thinkTimeSeconds = reportParameters.thinkTimeSeconds;
  thinkTimeSeconds = (thinkTimeSeconds == null ? 0 : thinkTimeSeconds);
  var pageName = reportParameters.pageName;
  pageName = (pageName == undefined ? null : pageName);
  var layoutType = reportParameters.layoutType;
  layoutType = (layoutType == undefined ? "Master" : layoutType);
  var sessionRestart = reportParameters.sessionRestart;
  var reportId = GetQSParam("reportId", embedUrl);
  var loadCounter = sessionStorage.getItem('reloadCounter') === null
    ? 0
    : sessionStorage.getItem('reloadCounter');

  startTime = sessionStorage.getItem('originalStartTime') ?? startTime;

  var errorTracker = "";
  var report;

  EmbedReport(
    errorTracker,
    report,
    loadCounter,
    bookmarkList,
    filtersCount,
    filtersList,
    PBIEtoken,
    embedUrl,
    reportId,
    pageName,
    layoutType,
    sessionRestart,
    thinkTimeSeconds,
    undefined
  );
});

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function EmbedReport(
  errorTracker,
  report,
  loadCounter,
  bookmarkList,
  filtersCount,
  filtersList,
  PBIEtoken,
  embedUrl,
  reportId,
  pageName,
  layoutType,
  sessionRestart,
  thinkTimeSeconds,
  prevTime
) {
  if (!socket.connected) {
    errorTracker = 'Socket disconnected.';
  };
  if (errorTracker.length != 0) return;
  if (report != undefined) report.off("rendered");
  if (loadCounter > 0) {
    var divCounter = document.getElementById('LoadReportCounter');
    var currTime = new Date();

    var avgDuration = Math.round((((currTime - startTime) - (thinkTimeSeconds * loadCounter * 1000)) / loadCounter)) / 1000;
    var currDuration = Math.round((((currTime - (prevTime ?? startTime)) - (thinkTimeSeconds * 1000)) / 1)) / 1000;

    divCounter.innerHTML = loadCounter
      + " refreshes<br/>"
      + currDuration + " seconds current refresh time<br/>"
      + avgDuration + " seconds average refresh time<br/>"
      + thinkTimeSeconds + " seconds think time<br/>"
      + "tab id: " + id;

    socket.emit('metric', {
      tabId: id,
      loadCounter: loadCounter,
      avgDuration: avgDuration,
      currDuration: currDuration,
      thinkTimeSeconds: thinkTimeSeconds,
    })
  }

  var models = window['powerbi-client'].models;
  var filterCounter = Math.floor(loadCounter / bookmarkList.length) % filtersCount;
  var bookmarkCounter = loadCounter % bookmarkList.length;
  var bookmarkValue = bookmarkList[bookmarkCounter];
  if (filtersList != null) {
    if (isNaN(filterCounter)) {
      filterValue = {
        slicers: [],
        filters: []
      };
    }
    else {
      filterValue = filtersList[filterCounter];
    }
  }
  else if (bookmarkCounter == 0) {
    filterValue = filterValue < filterMax ? ++filterValue : filterStart;
  }

  var config = {
    type: 'report',
    tokenType: models.TokenType.Aad,
    accessToken: PBIEtoken,
    embedUrl: embedUrl,
    id: reportId,
    filters: filterValue.filters,
    slicers: filterValue.slicers,
    pageName: pageName,
    bookmark: { name: bookmarkValue },
    settings: {
      filterPaneEnabled: true,
      navContentPaneEnabled: true,
      layoutType: models.LayoutType[layoutType]
    }
  };

  var justFlipBookmark = true;
  if (bookmarkCounter == 0 || report == undefined) {
    report = powerbi.embed(embedDiv, config);
    justFlipBookmark = false;
  }

  report.on("error", function (event) {

    var divCounter = document.getElementById('LoadReportCounter');
    var currentTime = new Date().toTimeString();
    divCounter.innerHTML = divCounter.innerHTML
      + "<br/>[Error at " + currentTime + "] "
      + event.detail.detailedMessage + " "
      + event.detail.errorCode;

    report.off("error");

    errorTracker = event.detail.message;
  });

  report.on("rendered", function () { setTimeout(EmbedReport(errorTracker, report, loadCounter, bookmarkList, filtersCount, filtersList, PBIEtoken, embedUrl, reportId, pageName, layoutType, sessionRestart, thinkTimeSeconds, currTime), thinkTimeSeconds * 1000) });

  if (justFlipBookmark) {
    report.bookmarksManager.apply(bookmarkValue);
  }

  loadCounter++;

  if ((loadCounter % sessionRestart) === 0) {
    sessionStorage.setItem('reloadCounter', loadCounter);
    sessionStorage.setItem('originalStartTime', startTime);
    location.reload(false);
  };
}

function GetQSParam(name, url) {

  var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(url);

  if (results == null) {
    return 0;
  }
  return results[1] || 0;
}
