const signalR = require('@microsoft/signalr');

async function testSignalR() {
  const connection = new signalR.HubConnectionBuilder()
    .withUrl('https://api.blackskyqore.com/notificationhub')
    .withAutomaticReconnect()
    .build();

  connection.on('terminalNewTaskAssigned', (data) => {
    console.log('Received terminalNewTaskAssigned:', data);
  });

  connection.on('reloadTerminalTasks', () => {
    console.log('Received reloadTerminalTasks');
  });

  try {
    await connection.start();
    console.log('SignalR Connected successfully! Connection ID:', connection.connectionId);
    await connection.stop();
  } catch (err) {
    console.error('SignalR Connection Error:', err.message);
  }
}

testSignalR();
