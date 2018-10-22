const express = require('express');
const app = express();
const fs = require('fs');
const perfmeter = require('./perfmeter');

const readFileContents = (filename) => new Promise((res, rej) => {
  fs.readFile(filename, (err, data) => {
    if (err) rej(err);
    res(data.toString());
  });
})


app.get('/', async (req, res) => {
  const { url = 'https://google.com' } = req.query;
  await perfmeter(url);
  const data = await readFileContents('data.json');
  res.json(JSON.parse(data));
});

app.listen(3000, function () {
  console.log(`We're ready 🙌  on port 3000!`);
});
