const mineflayer = require("mineflayer");
const express = require("express");
const Movements = require("mineflayer-pathfinder").Movements;
const pathfinder = require("mineflayer-pathfinder").pathfinder;
const { GoalBlock, GoalXZ } = require("mineflayer-pathfinder").goals;

const config = require("./settings.json");

const loggers = require("./logging.js");
const logger = loggers.logger;
const app = express();

app.get("/", (req, res) => {
   const currentUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
   res.send(
      'Your Bot Is Ready! Subscribe My Youtube: <a href="https://youtube.com/@H2N_OFFICIAL?si=UOLwjqUv-C1mWkn4">H2N OFFICIAL</a><br>Link Web For Uptime: <a href="' +
         currentUrl +
         '">' +
         currentUrl +
         "</a>",
   );
});

app.listen(5000, "0.0.0.0", () => {
   logger.info("Web server running on http://0.0.0.0:5000");
});

function createBot() {
   console.log("Creating bot with config:", {
      username: config["bot-account"]["username"],
      host: config.server.ip,
      port: config.server.port,
      version: config.server.version,
      auth: config["bot-account"]["type"]
   });
   
   const bot = mineflayer.createBot({
      username: config["bot-account"]["username"],
      password: config["bot-account"]["password"],
      auth: config["bot-account"]["type"],
      host: config.server.ip,
      port: config.server.port,
      version: config.server.version,
   });
   console.log("Bot Created - mineflayer.createBot() completed");

   console.log("Loading pathfinder plugin...");
   bot.loadPlugin(pathfinder);
   console.log("Pathfinder plugin loaded");
   
   console.log("Loading minecraft-data...");
   const mcData = require("minecraft-data")(bot.version);
   console.log("minecraft-data loaded");
   
   console.log("Creating default movements...");
   const defaultMove = new Movements(bot, mcData);
   console.log("Default movements created");
   //bot.settings.colorsEnabled = false;
   //bot.pathfinder.setMovements(defaultMove);

   console.log("Bot Loaded Plugin - Setting up event listeners...");
   console.log("Waiting for spawn event...");
   bot.once("spawn", () => {
      console.log("SPAWN EVENT TRIGGERED!");
      logger.info("Bot joined to the server");
      if (config.utils["auto-auth"].enabled) {
         logger.info("Started auto-auth module");

         let password = config.utils["auto-auth"].password;
         setTimeout(() => {
            bot.chat(`/register ${password} ${password}`);
            bot.chat(`/login ${password}`);
         }, 500);

         logger.info(`Authentication commands executed`);
      }

      if (config.utils["chat-messages"].enabled) {
         logger.info("Started chat-messages module");

         let messages = config.utils["chat-messages"]["messages"];

         if (config.utils["chat-messages"].repeat) {
            let delay = config.utils["chat-messages"]["repeat-delay"];
            let i = 0;

            setInterval(() => {
               bot.chat(`${messages[i]}`);

               if (i + 1 === messages.length) {
                  i = 0;
               } else i++;
            }, delay * 1000);
         } else {
            messages.forEach((msg) => {
               bot.chat(msg);
            });
         }
      }

      const pos = config.position;

      if (config.position.enabled) {
         logger.info(
            `Starting moving to target location (${pos.x}, ${pos.y}, ${pos.z})`,
         );
         bot.pathfinder.setGoal(new GoalBlock(pos.x, pos.y, pos.z));
      }

      if (config.utils["anti-afk"].enabled) {
         if (config.utils["anti-afk"].sneak) {
            bot.setControlState("sneak", true);
         }

         if (config.utils["anti-afk"].jump) {
            bot.setControlState("jump", true);
         }

         if (config.utils["anti-afk"]["hit"].enabled) {
            let delay = config.utils["anti-afk"]["hit"]["delay"];
            let attackMobs = config.utils["anti-afk"]["hit"]["attack-mobs"];

            setInterval(() => {
               if (attackMobs) {
                  let entity = bot.nearestEntity(
                     (e) =>
                        e.type !== "object" &&
                        e.type !== "player" &&
                        e.type !== "global" &&
                        e.type !== "orb" &&
                        e.type !== "other",
                  );

                  if (entity) {
                     bot.attack(entity);
                     return;
                  }
               }

               bot.swingArm("right", true);
            }, delay);
         }

         if (config.utils["anti-afk"].rotate) {
            setInterval(() => {
               bot.look(bot.entity.yaw + 1, bot.entity.pitch, true);
            }, 100);
         }

         if (config.utils["anti-afk"]["circle-walk"].enabled) {
            let radius = config.utils["anti-afk"]["circle-walk"]["radius"];
            circleWalk(bot, radius);
         }
      }
   });

   bot.on("chat", (username, message) => {
      if (config.utils["chat-log"]) {
         logger.info(`<${username}> ${message}`);
      }
   });

   bot.on("goal_reached", () => {
      if (config.position.enabled) {
         logger.info(`Bot arrived to target location. ${bot.entity.position}`);
      }
   });

   bot.on("death", () => {
      logger.warn(
         `Bot has been died and was respawned at ${bot.entity.position}`,
      );
   });

   if (config.utils["auto-reconnect"]) {
      bot.on("end", () => {
         setTimeout(() => {
            console.log("Reconnecting...");
            createBot();
         }, config.utils["auto-reconnect-delay"]);
      });
   }

   bot.on("kicked", (reason) => {
      let reasonText = reason;

      logger.warn(`Bot was kicked from the server. Reason: ${reasonText}`);
   });

   bot.on("connect", () => {
      console.log("Bot connected to server");
   });

   bot.on("login", () => {
      console.log("Bot logged in successfully");
      console.log("Waiting for spawn event after login...");
      
      // Timeout para detectar si spawn nunca llega
      const spawnTimeout = setTimeout(() => {
         console.log("⚠️  WARNING: Spawn event not received after 60 seconds!");
         console.log("This might indicate a server issue or connection problem.");
      }, 60000);
      
      // Cancelar timeout cuando spawn finalmente ocurra
      bot.once("spawn", () => {
         clearTimeout(spawnTimeout);
      });
   });

   bot.on("update_health", (health, food) => {
      console.log("Health/food update received - getting closer to spawn");
   });

   bot.on("game_state_change", (oldState, newState) => {
      console.log(`Game state changed from ${oldState} to ${newState}`);
   });

   bot.on("packet", (data, meta) => {
      if (meta.name === 'position') {
         console.log("Position packet received - spawn should happen soon");
      }
   });

   bot.on("error", (err) => {
      console.log("Bot error occurred:", err.message);
      logger.error(`${err.message}`);
   });

   bot.on("end", (reason) => {
      console.log("Bot connection ended. Reason:", reason);
   });
}

function circleWalk(bot, radius) {
   // Make bot walk in square with center in bot's  wthout stopping
   return new Promise(() => {
      const pos = bot.entity.position;
      const x = pos.x;
      const y = pos.y;
      const z = pos.z;

      const points = [
         [x + radius, y, z],
         [x, y, z + radius],
         [x - radius, y, z],
         [x, y, z - radius],
      ];

      let i = 0;
      setInterval(() => {
         if (i === points.length) i = 0;
         bot.pathfinder.setGoal(new GoalXZ(points[i][0], points[i][2]));
         i++;
      }, 1000);
   });
}

createBot();
