/**
 * Quick test script for the Mundo Cleaver server
 * Run: node test-client.js
 */

import { io } from 'socket.io-client';

const SERVER_URL = 'http://localhost:3000';

// Create two test clients
const client1 = io(SERVER_URL);
const client2 = io(SERVER_URL);

let roomCode = null;

console.log('🎮 Starting Mundo Cleaver server test...\n');

// Client 1 (Host)
client1.on('connect', () => {
    console.log('✅ Client 1 connected:', client1.id);
    console.log('📤 Client 1: Creating room...');
    client1.emit('createRoom', { gameMode: '1v1' });
});

client1.on('roomCreated', (data) => {
    console.log('📥 Client 1: Room created!');
    console.log('   Room Code:', data.roomCode);
    console.log('   Team:', data.team);
    console.log('   Is Host:', data.isHost);
    roomCode = data.roomCode;

    // Client 2 joins after room is created
    setTimeout(() => {
        console.log('\n📤 Client 2: Joining room', roomCode);
        client2.emit('joinRoom', { roomCode });
    }, 500);
});

client1.on('roomState', (data) => {
    console.log('📥 Client 1: Room state update');
    console.log('   Players:', data.players.length);
    data.players.forEach(p => {
        console.log(`   - ${p.playerId.slice(0, 8)}... Team ${p.team} ${p.isReady ? '✓ Ready' : ''} ${p.isHost ? '(Host)' : ''}`);
    });
});

client1.on('S_INIT', (data) => {
    console.log('\n🎮 Client 1: Game initialized!');
    console.log('   My Team:', data.team);
    console.log('   Players:', data.players.length);
});

client1.on('countdownStart', (data) => {
    console.log('\n⏱️ Client 1: Countdown started!', data.countdownSeconds, 'seconds');
});

client1.on('serverGameState', (data) => {
    // Only log first few state updates
    if (data.serverTick <= 3) {
        console.log('📊 Game tick', data.serverTick, '- Players:', data.players.length, 'Knives:', data.knives.length);
    }
});

// Client 2 (Joiner)
client2.on('connect', () => {
    console.log('✅ Client 2 connected:', client2.id);
});

client2.on('roomJoined', (data) => {
    console.log('📥 Client 2: Joined room!');
    console.log('   Room Code:', data.roomCode);
    console.log('   Team:', data.team);

    // Both players ready up
    setTimeout(() => {
        console.log('\n📤 Both players marking ready...');
        client1.emit('playerReady', { roomCode });
        client2.emit('playerReady', { roomCode });

        // Host starts game after ready
        setTimeout(() => {
            console.log('📤 Client 1 (Host): Starting game...');
            client1.emit('startGame', { roomCode });
        }, 500);
    }, 500);
});

client2.on('roomState', (data) => {
    console.log('📥 Client 2: Room state update');
    console.log('   Players:', data.players.length);
});

client2.on('S_INIT', (data) => {
    console.log('🎮 Client 2: Game initialized!');
    console.log('   My Team:', data.team);
});

client2.on('countdownStart', (data) => {
    console.log('⏱️ Client 2: Countdown started!');

    // Test movement after countdown
    setTimeout(() => {
        console.log('\n📤 Client 1: Sending move command...');
        client1.emit('playerMove', {
            roomCode,
            targetX: 0,
            targetZ: 10,
            actionId: 1,
            seq: 1,
            clientTime: Date.now()
        });
    }, 6000); // Wait for countdown
});

client1.on('serverMoveAck', (data) => {
    console.log('📥 Client 1: Move acknowledged at', data.x.toFixed(2), data.z.toFixed(2));

    // Test knife throw
    setTimeout(() => {
        console.log('\n📤 Client 1: Throwing knife...');
        client1.emit('knifeThrow', {
            roomCode,
            targetX: 30,
            targetZ: 0,
            actionId: 2,
            clientTimestamp: Date.now(),
            clientSendTime: Date.now()
        });
    }, 1000);
});

client1.on('serverKnifeSpawn', (data) => {
    console.log('🔪 Knife spawned:', data.knifeId, 'from team', data.throwerTeam);
});

client1.on('serverKnifeHit', (data) => {
    console.log('💥 Knife hit!', data.targetId, 'Health:', data.newHealth);
});

client1.on('gameOver', (data) => {
    console.log('\n🏆 GAME OVER! Winner: Team', data.winner);
    console.log('   Reason:', data.reason);

    // Cleanup
    setTimeout(() => {
        console.log('\n✅ Test complete! Disconnecting...');
        client1.disconnect();
        client2.disconnect();
        process.exit(0);
    }, 1000);
});

// Error handling
client1.on('error', (err) => console.error('❌ Client 1 error:', err));
client2.on('error', (err) => console.error('❌ Client 2 error:', err));
client1.on('joinError', (err) => console.error('❌ Join error:', err));
client2.on('joinError', (err) => console.error('❌ Join error:', err));

// Timeout
setTimeout(() => {
    console.log('\n⏰ Test timeout (30s) - disconnecting...');
    client1.disconnect();
    client2.disconnect();
    process.exit(0);
}, 30000);
