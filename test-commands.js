// Test command loading and slash command data
const fs = require('fs');
const path = require('path');

console.log('Testing command loading...');

try {
    // Test loading commands
    const commandsPath = path.join(__dirname, 'src', 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    console.log('Found command files:', commandFiles);

    const commands = [];
    
    for (const file of commandFiles) {
        try {
            const command = require(path.join(commandsPath, file));
            console.log(`${file}: Has data property: ${!!command.data}`);
            if (command.data) {
                console.log(`  - Name: ${command.data.name}`);
                console.log(`  - Description: ${command.data.description}`);
                commands.push(command.data.toJSON());
            }
        } catch (error) {
            console.error(`Error loading ${file}:`, error.message);
        }
    }
    
    console.log(`\nSuccessfully loaded ${commands.length} commands for registration`);
    
    // Force exit to prevent hanging
    setTimeout(() => {
        console.log('Test completed');
        process.exit(0);
    }, 100);
    
} catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
}