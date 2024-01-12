const { Client, Collection, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const secrettoken = process.env.TOKEN;
const { REST } = require('@discordjs/rest');
const rest = new REST().setToken(secrettoken);
const { Routes } = require('discord-api-types/v9');
const clientId = process.env.CLIENT_ID; // Define the clientId variable using the environment variable
const guildId = process.env.GUILD_ID;



const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
    // Add more intents as needed based on your bot's functionality
  ],
});
client.commands = new Collection();
client.cooldowns = new Collection();
const MongoClient = require('mongodb').MongoClient;
const url = process.env.MONGOLINK;
const dbName = process.env.myproject;



async function startBot() {
  // Create a new MongoClient
  const mongoClient = new MongoClient(url, { useUnifiedTopology: true });
  try {
    // Use connect method to connect to the server
    await mongoClient.connect();
    console.log("Connected successfully to server");
    const db = mongoClient.db(dbName);
    // Make the db connection available to the interactionCreate event handler as a client property
    client.db = db;
    // Your bot's startup code goes here...
  } catch (err) {
    console.error('Error connecting to MongoDB:', err);
    process.exit(1); // Exit using a non-zero code to indicate an error
  }
}

startBot();
const interactionCreate = require('./events/interactionCreate.js');
const commands = [];
client.commands = new Collection();
const readCommands = (dir) => {
  // Read the directory contents
  const files = fs.readdirSync(dir);
  // Iterate over each file in the directory
  for (const file of files) {
    // Construct the full path to the file
    const filePath = path.join(dir, file);
    // Check if the file is a directory itself
    if (fs.statSync(filePath).isDirectory()) {
      // If it's a directory, read it recursively
      readCommands(filePath);
    } else if (file.endsWith('.js')) {
      // If it's a JavaScript file, require it and set up the command
      const command = require(filePath);
      // Ensure that the command file follows the expected format
      if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
        client.commands.set(command.data.name, command);
      } else {
        console.log(`The command at "${filePath}" is not properly formatted.`);
      }
    }
  }
};
// Start reading from the initial commands folder
const commandsPath = path.join(__dirname, 'commands');
readCommands(commandsPath);

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}
// and deploy your commands!
(async () => {
	try {
		console.log(`Started refreshing ${commands.length} application (/) commands.`);

		// The put method is used to fully refresh all commands in the guild with the current set
		const data = await rest.put(
			Routes.applicationGuildCommands(clientId, guildId),
			{ body: commands },
		);

		console.log(`Successfully reloaded ${data.length} application (/) commands.`);
	} catch (error) {
		// And of course, make sure you catch and log any errors!
		console.error(error);
	}
})();

async function cleanupCommands() {
  const unusedCommands = ['hello', 'ping']; // replace with your old command names

  // Cleanup global commands
  const globalCommands = await client.application.commands.fetch();
  globalCommands.forEach(command => {
    if (unusedCommands.includes(command.name)) {
      client.application.commands.delete(command.id);
      console.log(`Deleted global command: ${command.name}`);
    }
  });

  // Cleanup guild-specific commands for each guild the bot is in
  client.guilds.cache.forEach(async guild => {
    const guildCommands = await guild.commands.fetch();
    guildCommands.forEach(command => {
      if (unusedCommands.includes(command.name)) {
        guild.commands.delete(command.id);
        console.log(`Deleted guild command: ${command.name} in guild: ${guild.id}`);
      }
    });
  });
}



client.on('messageCreate', async (message) => {
  if (!message.content.startsWith('!') || message.author.bot) return;

  const args = message.content.slice(1).split(/ +/);
  const commandName = args.shift().toLowerCase();

  const command = client.commands.get(commandName) ||
                  client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

  if (!command) return;

  try {
    await command.execute(message, args);
  } catch (error) {
    console.error(error);
    message.reply('There was an error while trying to execute that command!');
  }
});

client.login(secrettoken);
