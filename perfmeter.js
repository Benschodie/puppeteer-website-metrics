const puppeteer = require('puppeteer');
const lighthouse = require('lighthouse');
const { URL } = require('url');
const fs = require('fs');


const writeFile = async (filename, data) => new Promise((res, rej) => {
  fs.writeFile(filename, data, (err) => {
    if (err) rej(err);
    res();
  });
});

const extractDataFromPerformanceTiming = (timing, ...dataNames) => {
  const navigationStart = timing.navigationStart;

  const extractedData = {};
  dataNames.forEach(name => {
    extractedData[name] = timing[name] - navigationStart;
  });

  return extractedData;
};

const performanceTiming = async (browser, url) => {
  const page = await browser.newPage();
  await page.goto(url);

  const performanceTiming = JSON.parse(
    await page.evaluate(() => JSON.stringify(window.performance.timing))
  );

  return extractDataFromPerformanceTiming(
    performanceTiming,
    'responseEnd',
    'domInteractive',
    'domContentLoadedEventEnd',
    'loadEventEnd'
  );
}

const networkTab = async (browser, url) => {
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', request => {
    request.continue();
  });
  let networkRequests = [];
  let networkRequestsReload = [];
  let reload = false;
  page.on('response', response => {
    const req = response.request();
    const obj = {
      method: req.method(),
      url: response.url(),
      responseHeaders: response.headers(),
      fromCache: response.fromCache()
    };
    if (reload) {
      networkRequestsReload.push(obj)
    } else {
      networkRequests.push(obj);
    }
  });
  await page.goto(url, { waitUntil: 'networkidle0' });
  reload = true;
  await page.reload({ waitUntil: 'networkidle0' })
  return { networkRequests, networkRequestsReload };
}


const launchBrowser = () => puppeteer.launch({
  headless: true,
  defaultViewport: {
    width: 1280,
    height: 800,
  },
});


module.exports = async function (url) {
  const startTime = Date.now();
  let data = {};

  let browser = await launchBrowser();

  data.performanceData = await performanceTiming(browser, url);

  const { lhr } = await lighthouse(url, {
    port: (new URL(browser.wsEndpoint())).port,
    output: 'json',
    logLevel: 'silent',
  });

  data.lighthouse = lhr;

  await browser.close();

  browser = await launchBrowser();

  data.network = await networkTab(browser, url);

  await browser.close();

  await writeFile('data.json', JSON.stringify(data));

  const endTime = Date.now();
  console.log(`It took ${(endTime - startTime) / 1000} seconds`);

}
