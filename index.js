"use strict";

var http = require("http"),
    util = require("util");

var async = require("async"),
    Canvas = require("canvas"),
    cors = require("cors"),
    express = require("express"),
    request = require("request");

var app = express(),
    Image = Canvas.Image;

var PROVIDERS = require("./providers.json");

app.configure(function() {
  app.use(express.responseTime());
  app.use(express.logger());
  app.use(cors());

  http.globalAgent.maxSockets = 32;
});

app.get("/:tilesets/:z/:x/:y.png", function(req, res) {
  var tasks = req.params.tilesets.split(",")
    .map(function(x) {
      return x.trim();
    })
    .map(function(tileset) {
      if (!(tileset in PROVIDERS)) {
        // noop
        return function(callback) {
          return callback();
        };
      }

      return function(callback) {
        request({
          url: util.format(PROVIDERS[tileset], req.params.z, req.params.x, req.params.y),
          encoding: null
        }, function(err, res, body) {
          if (err) {
            console.warn(err);
          }

          var img;

          if (res && res.statusCode === 200) {
            img = new Image();
            img.src = body;
          }

          return callback(null, img);
        });
      };
    });

  async.parallel(tasks, function(err, images) {
    var canvas = new Canvas(256 * images.length, 256),
        ctx = canvas.getContext("2d");

    var x = 0;
    images.forEach(function(img) {
      if (img) {
        ctx.drawImage(img, x, 0, 256, 256);
      }

      x += 256;
    });

    res.set("Content-Type", "image/png");

    canvas.toBuffer(function(err, buf) {
      return res.send(buf);
    });
  });
});

app.listen(process.env.PORT || 8080, function() {
  console.log("Listening at http://%s:%d/", this.address().address, this.address().port);
});
