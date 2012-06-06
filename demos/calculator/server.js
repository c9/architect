#!/usr/bin/env node

var path = require('path');
var architect = require("architect");

var configPath = path.join(__dirname, "config.js");
var config = architect.loadConfig(configPath);

architect.createApp(config, function (err, app) {
  if (err) throw err;
  console.log("app ready");
});
