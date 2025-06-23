#!/usr/bin/env node

/**
 * TURN Server Connectivity Test
 * Tests TURN server functionality programmatically
 */

const net = require('net');
const dgram = require('dgram');
const { exec } = require('child_process');

// Test configuration
const TURN_CONFIG = {
  ports: {
    http: 7880,
    rtc_tcp: 7881,
    turn_udp: 3478,
    turn_tcp: 3478,
    turn_tls: 5349
  },
  timeout: 3000
};

class TurnTester {
  constructor() {
    this.passed = 0;
    this.failed = 0;
  }

  log(message, status = 'INFO') {
    const colors = {
      PASS: '\x1b[32m',
      FAIL: '\x1b[31m',
      INFO: '\x1b[34m',
      WARN: '\x1b[33m'
    };
    const reset = '\x1b[0m';
    const time = new Date().toLocaleTimeString();
    console.log(`${colors[status]}[${time}] ${status}: ${message}${reset}`);
  }

  async testTcpPort(port, name) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const timer = setTimeout(() => {
        socket.destroy();
        resolve(false);
      }, TURN_CONFIG.timeout);

      socket.connect(port, 'localhost', () => {
        clearTimeout(timer);
        socket.destroy();
        resolve(true);
      });

      socket.on('error', () => {
        clearTimeout(timer);
        resolve(false);
      });
    });
  }

  async testUdpPort(port, name) {
    return new Promise((resolve) => {
      const client = dgram.createSocket('udp4');
      const timer = setTimeout(() => {
        client.close();
        resolve(false);
      }, TURN_CONFIG.timeout);

      const message = Buffer.from('test');
      client.send(message, port, 'localhost', (err) => {
        clearTimeout(timer);
        client.close();
        resolve(!err);
      });

      client.on('error', () => {
        clearTimeout(timer);
        client.close();
        resolve(false);
      });
    });
  }

  async testDockerStatus() {
    return new Promise((resolve) => {
      exec('docker-compose ps', (error, stdout) => {
        if (error) {
          resolve(false);
        } else {
          resolve(stdout.includes('livekit') && stdout.includes('Up'));
        }
      });
    });
  }

  async runTest(name, testFunc) {
    try {
      const result = await testFunc();
      if (result) {
        this.log(`${name}`, 'PASS');
        this.passed++;
      } else {
        this.log(`${name}`, 'FAIL');
        this.failed++;
      }
    } catch (error) {
      this.log(`${name} - ${error.message}`, 'FAIL');
      this.failed++;
    }
  }

  async runAllTests() {
    this.log('TURN Server Connectivity Test Suite Starting...', 'INFO');
    this.log('='.repeat(50), 'INFO');

    await this.runTest('Docker Container Running', () => this.testDockerStatus());
    await this.runTest('LiveKit HTTP Port (7880)', () => this.testTcpPort(TURN_CONFIG.ports.http, 'HTTP'));
    await this.runTest('LiveKit RTC TCP Port (7881)', () => this.testTcpPort(TURN_CONFIG.ports.rtc_tcp, 'RTC-TCP'));
    await this.runTest('TURN UDP Port (3478)', () => this.testUdpPort(TURN_CONFIG.ports.turn_udp, 'TURN-UDP'));
    await this.runTest('TURN TCP Port (3478)', () => this.testTcpPort(TURN_CONFIG.ports.turn_tcp, 'TURN-TCP'));
    await this.runTest('TURN TLS Port (5349)', () => this.testTcpPort(TURN_CONFIG.ports.turn_tls, 'TURN-TLS'));

    this.log('='.repeat(50), 'INFO');
    this.log(`Tests Passed: ${this.passed}`, this.passed > 0 ? 'PASS' : 'INFO');
    this.log(`Tests Failed: ${this.failed}`, this.failed > 0 ? 'FAIL' : 'INFO');

    if (this.failed === 0) {
      this.log('All connectivity tests passed!', 'PASS');
      this.log('TURN server appears to be accessible', 'PASS');
    } else {
      this.log('Some tests failed - check TURN server configuration', 'FAIL');
    }

    return this.failed === 0;
  }
}

if (require.main === module) {
  const tester = new TurnTester();
  tester.runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = TurnTester; 