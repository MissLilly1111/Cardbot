const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const GUILD_ID = process.env.GUILD_ID;
const CLIENT_ID = process.env.CLIENT_ID;
const commands = [
  {
    name: 'hey',
    description: 'Replies with Pong!',
  },
  {
    // Add your next command here
  },
];
const rest = new REST({ version: '1' }).setToken(process.env.TOKEN);
(async () => {
  try {
    console.log('Started refreshing application (/) commands.');
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands },
    );
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();