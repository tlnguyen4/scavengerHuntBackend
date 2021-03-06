const express = require('express');
const app = express();
const models = require('./models/models');
const User = models.User;
const Game = models.Game;
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
mongoose.connect(process.env.MONGODB_URI);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.get('/', function(req, res) {
  res.send('Heroku running!');
})

app.post('/checkUsername', function(req, res) {
  User.findOne({username: req.body.username}, function(err, user) {
    if (err) {
      res.send({
        checked: false,
        error: err,
      })
    } else if (user) {
      res.send({
        checked: true,
        existed: true,
      })
    } else {
      res.send({
        checked: true,
        existed: false,
      })
    }
  })
})

app.post('/register', function(req, res) {
  new User({
    name: req.body.name,
    username: req.body.username,
    password: req.body.password
  }).save(function(err, user) {
    if (err) {
      res.send({
        register: false,
        error: err
      })
    } else {
      res.send({
        register: true,
        user: user
      });
    }
  });
});

app.post('/login', function(req, res) {
  User.findOne({username: req.body.username}, function(err, user) {
    if (err) {
      res.send({
        login: false,
        error: "User does not exist. Please sign up before logging in."
      });
    } else if (user) {
      if (user.password !== req.body.password) {
        res.send({
          login: false,
          error: "Wrong Password"
        });
      } else if (user.password === req.body.password) {
        if (user.gameID) {
          Game.findById(user.gameID, function(err, game) {
            res.send({
              login: true,
              user: user,
              game: game,
            });
          });
        } else {
          res.send({
            login: true,
            user: user,
            game: null
          });
        }
      }
    }
  });
});

app.post('/newHunt', function(req, res) {
  new Game({
    creator: req.body.creator,
    creatorID: req.body.creatorID,
    locations: [],
    players: []
  }).save(function(err, game) {
    if (err) {
      res.send({
        created: false,
        error: "Cannot create new game"
      })
    } else {
      User.findById(req.body.creatorID, function(err, user) {
        user.gameID = game._id;
        user.save(function(err) {
          if (err) {
            res.send({
              created: false,
              error: "Cannot save new data to user."
            })
          } else {
            res.send({
              created: true,
              game: game
            });
          }
        });
      });
    }
  });
});

app.post('/joinHunt', function(req, res) {
  Game.findById(req.body.gameID).exec()
    .then(game => {
      game.players.push(req.body.playerID);
      game.save(function(err, updatedGame) {
        if (err) {
          res.send({
            joined: false,
            error: err
          })
        } else {
          User.findById(req.body.playerID).exec()
            .then(player => {
              player.gameID = req.body.gameID;
              player.gameProgress = Array(game.locations.length).fill(false);
              player.save((err, updatedPlayer) => {
                if (err) {
                  res.send({
                    joined: false,
                    error: err,
                  });
                } else {
                  res.send({
                    joined: true,
                    creatorID: updatedGame.creatorID
                  });
                }
              });
            })
            .catch(err => {
              res.send({
                joined: false,
                error: err
              })
            })
        }
      })
    })
    .catch(err => {
      res.send({
        joined: false,
        error: err
      })
    })
})

app.post('/getProgress', function(req, res) {
  User.findById(req.body.playerID, function(err, player) {
    if (err) {
      res.send({
        progress: false,
        error: err
      })
    } else {
      Game.findById(player.gameID).exec()
        .then(game => {
          res.send({
            progress: true,
            gameProgress: player.gameProgress,
            game: game.locations,
            gameID: player.gameID
          })
        })
        .catch(err => {
          res.send({
            progress: false,
            error: err
          })
        })
    }
  })
})

app.post('/addLocation', function(req, res) {
  Game.findById(req.body.gameID, function(err, game) {
    var updateLocations = game.locations;
    updateLocations.push({name: req.body.locationName, hint: req.body.locationHint, clue: req.body.locationClue, lat: req.body.lat, long: req.body.long});
    game.locations = updateLocations;
    game.save(function(err, game2) {
      if (err) {
        res.send({
          added: false,
          error: "Cannot add location in route."
        })
      } else {
        res.send({
          added: true,
          locations: game2.locations,
        })
      }
    })
  })
})

app.post('/getLocations', function(req, res) {
  Game.findById(req.body.gameID, function(err, game) {
    if (err) {
      res.send({
        retrieved: false,
        error: "Cannot find game."
      })
    } else {
      res.send({
        retrieved: true,
        locations: game.locations,
      })
    }
  })
})

app.post('/checkIn', function(req, res) {
  User.findById(req.body.playerID).exec()
    .then(player => {
      var array = player.gameProgress.slice();
      array[req.body.index] = true;
      player.gameProgress = array;
      player.save((err, updatedPlayer) => {
        if (err) {
          res.send({
            checked: false,
            error: err,
          });
        } else {
          res.send({
            checked: true,
            gameProgress: updatedPlayer.gameProgress,
          });
        }
      })
    })
    .catch(err => {
      res.send({
        checked: false,
        error: err,
      });
    });
})

app.post('/deleteLocation', function(req, res) {
  Game.findById(req.body.gameID).exec()
    .then(game => {
      var newArr = game.locations.slice();
      game.locations.forEach((location, index) => {
        if (location.lat === req.body.lat && location.long === req.body.long) {
          newArr.splice(index, 1);
          return;
        }
      })
      game.locations = newArr;
      game.save((err, updatedGame) => {
        if (err) {
          res.send({
            deleted: false,
            error: err,
          })
        } else {
          res.send({
            deleted: true,
            locations: updatedGame.locations
          })
        }
      })
    })
    .catch(err => {
      res.send({
        deleted: false,
        error: err
      })
    })
})

app.post('/deleteHunt', function(req, res) {
  Game.findById(req.body.gameID).exec()
    .then(game => {
      var playerArray = game.players;
      playerArray.push(req.body.creatorID);
      removeGameFromPlayer(playerArray)
        .then(updatedPlayerObject => {
          Game.findByIdAndRemove(req.body.gameID, err => {
            if (err) {
              res.send({
                deleted: false,
                error: err
              })
            } else {
              res.send({
                deleted: true
              })
            }
          });
        })
        .catch(err => {
          res.send({
            deleted: false,
            error: err
          })
        })
    })
    .catch(err => {
      res.send({
        deleted: false,
        error: err
      })
    })
})

app.post('/leaveHunt', function(req, res) {
  User.findById(req.body.playerID).exec()
    .then(player => {
      player.gameID = '';
      player.gameProgress = [];
      player.save(err => {
        if (err) {
          res.send({
            left: false,
            error: err
          })
        } else {
          Game.findById(req.body.gameID).exec()
            .then(game => {
              game.players.forEach((playerID, index) => {
                if (playerID === req.body.playerID) {
                  game.players.splice(index, 1);
                  return;
                }
              })
              game.save(err => {
                if (err) {
                  res.send({
                    left: false,
                    error: err
                  })
                } else {
                  res.send({
                    left: true,
                    error: err
                  })
                }
              })
            })
            .catch(err => {
              res.send({
                left: false,
                error: err
              })
            })
        }
      })
    })
    .catch(err => {
      res.send({
        left: false,
        error: err
      })
    })
})

const PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
  console.log("Backend server for Scavenger Hunt running on port 3000");
});

const removeGameFromPlayer = function(playerArray) {
  return new Promise(function(resolve, reject) {
    var playerPromise = playerArray.map(function(id) {
      return User.findById(id).exec();
    })
    Promise.all(playerPromise)
      .then(playerObjects => {
        playerObjects.map(eachObject => {
          eachObject.gameID = '';
          eachObject.gameProgress = [];
          eachObject.save(function(err, updatedPlayer) {
            if (err) {
              reject(err);
            } else {
              resolve(updatedPlayer);
            }
          })
        })
      })
      .catch(err => {
        reject(err);
      });
  });
}
