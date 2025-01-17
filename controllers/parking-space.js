var request = require('request');
var ParkingSpace = require('../models').ParkingSpace;
var User = require('../models').User;
var Trip = require('../models').Trip;

var onErr = function(err, res) {
  err && console.log(err);
  res.status(500).send(err);
};

exports.occupy = function(req, res) {
  var userId = req.user ? req.user._id : req.query.userId;
  if (!userId) return onErr('Invalid user', res);
  User.findById(userId, function(err, user) {
    if (err) return onErr(err, res);
    // Triggered whenever a device sensor status goes from 0-1.
    // 1. Corresponding parking space in the database is set to reserved
    // from the given timestamp.
    ParkingSpace.findById(req.params.id, function(err, space) {
      if (err || !space) return onErr(err || 'Invalid space', res);
      // TODO handling for trying to reserve an already taken space?
      space.isAvailable = false;
      space.occupiedBy = user && user._id;
      space.occupiedAt = new Date();
      user.currentSpace = space._id;
      space.save(function(err) {
        if (err) return onErr(err, res);
        user.save(function(err) {
          if (err) return onErr(err, res);
          res.send('Success');
        });
      });
    });
  });
};

exports.occupyPost = function(req, res) {
  // Triggered whenever a device sensor status goes from 0-1.
  // 1. Corresponding parking space in the database is set to reserved
  // from the given timestamp.
  console.log(req.body);
  ParkingSpace.findByDeviceID(req.body.device.id, function(err, space) {
    if (err || !space) return onErr(err || 'Invalid space', res);
    // TODO handling for trying to reserve an already taken space?
    var value = req.body.values.prox.value;
    if (value) {
      space.isAvailable = false;
      space.occupiedAt = new Date();
    } else {
      space.isAvailable = true;
      space.occupiedAt = undefined;
      space.occupiedBy = undefined;
    }
    space.save(function(err) {
      if (err) return onErr(err, res);
      console.log('updated space', space);
      res.send('Success');
    });
  });
};

exports.leave = function(req, res) {
  var userId = req.user ? req.user._id : req.query.userId;
  if (!userId) return onErr('Invalid user', res);
  User.findById(userId, function(err, user) {
    if (err || !user) return onErr(err, res);
    if (!user.currentSpace) return onErr('Not parked');
    ParkingSpace.findById(user.currentSpace, function(err, space) {
      if (err) return onErr(err);
      var oldSpace = user.currentSpace;
      user.currentSpace = undefined;
      space.occupiedBy = undefined;
      space.isAvailable = true;
      var occupiedAt = new Date(space.occupiedAt);
      var now = new Date();
      var hours = Math.abs(now - occupiedAt) / 36e5;
      space.save(function(err) {
        if (err) return onErr(err, res);
        user.save(function(err) {
          if (err) return onErr(err, res);
          var occupiedAt = new Date(space.occupiedAt);
          var now = new Date();
          var hours = Math.abs(now - occupiedAt) / 36e5;
          Trip.create({
            driver: userId,
            parkingSpace: oldSpace,
            startTime: occupiedAt,
            endTime: new Date(),
            hourlyRate: space.hourlyRate,
            cost: space.hourlyRate * hours
          }, function(err, trip) {
            if (err) return onErr(err);
            res.send(trip);
          });
        });
      });
    });
  });
};
