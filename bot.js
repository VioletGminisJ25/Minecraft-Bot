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
                  auth: config["bot-account"]["type"],
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

               console.log("Bot Loaded Plugin - Setting up event listeners...");
               console.log("Waiting for spawn event...");

               bot.once("login", () => {
                  console.log("Bot logged in - sending register/login if needed");
                  if (config.utils["auto-auth"].enabled) {
                     let password = config.utils["auto-auth"].password;
                     setTimeout(() => {
                        bot.chat(`/register ${password} ${password}`);
                        bot.chat(`/login ${password}`);
                        console.log("Authentication commands sent");
                     }, 1000);
                  }
               });

               bot.on("message", (jsonMsg) => {
                  const message = jsonMsg.toString();
                  console.log("[Server Message]", message);

                  if (message.includes("already registered") || message.includes("ya estás registrado")) {
                     let password = config.utils["auto-auth"].password;
                     bot.chat(`/login ${password}`);
                     console.log("Detected already registered - sending /login");
                  }

                  if (message.includes("successfully registered") || message.includes("Registrado exitosamente")) {
                     let password = config.utils["auto-auth"].password;
                     bot.chat(`/login ${password}`);
                     console.log("Just registered - sending /login now");
                  }

                  if (message.includes("successfully logged in") || message.includes("Sesión iniciada exitosamente")) {
                     console.log("Login confirmed - waiting for spawn...");
                  }
               });

               bot.once("spawn", () => {
                  console.log("SPAWN EVENT TRIGGERED!");
                  logger.info("Bot joined to the server");
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
                  logger.warn(`Bot has died and respawned at ${bot.entity.position}`);
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
                  logger.warn(`Bot was kicked from the server. Reason: ${reason}`);
               });

               bot.on("connect", () => {
                  console.log("Bot connected to server");
               });

               bot.on("login", () => {
                  console.log("Bot logged in successfully");
                  console.log("Waiting for spawn event after login...");

                  const spawnTimeout = setTimeout(() => {
                     console.log("⚠️  WARNING: Spawn event not received after 60 seconds!");
                     console.log("This might indicate a server issue or EasyAuth blocking spawn.");
                  }, 60000);

                  bot.once("spawn", () => {
                     clearTimeout(spawnTimeout);
                  });
               });

               bot.on("update_health", (health, food) => {
                  console.log("Health/food update received - getting closer to spawn");
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

            createBot();
