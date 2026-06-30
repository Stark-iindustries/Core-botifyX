const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

class PluginManager {
  constructor(directory) {
    this.directory = directory;
    this.pluginsCache = new Map();
    this.commandMap = new Map();
  }

  async getPluginFiles(dir) {
    const files = await fsp.readdir(dir);
    return files
      .filter(file => file.endsWith('.js'))
      .map(file => path.join(dir, file));
  }

async loadAllPlugins() {
  try {
    const pluginFiles = await this.getPluginFiles(this.directory);

    this.pluginsCache.clear();
    this.commandMap.clear();

    let commandCount = 0;

    for (const filePath of pluginFiles) {
      delete require.cache[require.resolve(filePath)];
      const plugins = require(filePath);

      if (Array.isArray(plugins)) {
        this.pluginsCache.set(filePath, plugins);

        for (const plugin of plugins) {
          const commands = Array.isArray(plugin.command) ? plugin.command : [plugin.command];
          for (const cmd of commands) {
            this.commandMap.set(cmd, { plugin, filePath });
            commandCount++;
          }
        }
      }
    }

    console.log(`[BOTIFY-X] Plugins loaded: ${pluginFiles.length} files`)
   console.log(`[BOTIFY-X] Commands loaded: ${commandCount}`);
    return true;

  } catch (error) {
    console.error('❌ Error loading plugins:', error);
    return false;
  }
}

async executePlugin(globalContext, command) {
  try {
    const pluginInfo = this.commandMap.get(command);

    if (!pluginInfo) {
      return false;
    }

    const { plugin } = pluginInfo;

    if (plugin.react && global.db && global.db.settings.autoreact === "command") {
      await globalContext.Cypher.sendMessage(globalContext.m.chat, {
        react: {
          text: plugin.react,
          key: globalContext.m.key,
        }
      });
    }

    await plugin.operate(globalContext);
    return true;

  } catch (err) {
    console.error(`❌ Failed to execute command "${command}":`, err);
    return false;
  }
}

  async reloadPlugin(filePath) {
    try {
      delete require.cache[require.resolve(filePath)];
      const plugins = require(filePath);

      if (!Array.isArray(plugins)) return false;

      for (const [cmd, data] of this.commandMap.entries()) {
        if (data.filePath === filePath) this.commandMap.delete(cmd);
      }

      this.pluginsCache.set(filePath, plugins);

      for (const plugin of plugins) {
        const commands = Array.isArray(plugin.command) ? plugin.command : [plugin.command];
        for (const cmd of commands) {
          this.commandMap.set(cmd, { plugin, filePath });
          console.log(`[BOTIFY-X] Reloaded command: "${cmd}"`);
        }
      }

      return true;

    } catch (err) {
      console.error(`❌ Failed to reload plugin at ${filePath}:`, err);
      return false;
    }
  }
}

const pluginManager = new PluginManager(path.resolve(__dirname, '../Plugins'));
module.exports = pluginManager;