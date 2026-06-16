const { spawn } = require('child_process');
const { EventEmitter } = require('events');

class Player extends EventEmitter {
  constructor() {
    super();
    this.process = null;
    this.state = 'stopped';
    this.title = '';
    this.artist = '';
    this.coverUrl = '';
    this.streamUrl = null;
    this.position = 0;
    this.seekOffset = 0;
    this.startTime = null;
    this.volume = 50;
    this._interval = null;
  }

  play(streamUrl, title, artist, coverUrl) {
    this.stop();

    this.streamUrl = streamUrl;
    this.title = title || '';
    this.artist = artist || '';
    this.coverUrl = coverUrl || '';

    const args = ['-nodisp', '-autoexit', '-loglevel', 'quiet', streamUrl];
    this.process = spawn('ffplay', args, { stdio: 'ignore' });
    this.state = 'playing';
    this.position = 0;
    this.seekOffset = 0;
    this.startTime = Date.now();
    this._startTick();

    this.process.on('exit', (code) => {
      this._stopTick();
      this.state = 'stopped';
      this.emit('trackEnd', { code });
    });

    this.emit('stateChange', { state: 'playing', title: this.title, artist: this.artist });
  }

  pause() {
    if (this.process && this.state === 'playing') {
      try { this.process.kill('SIGSTOP'); } catch {}
      this.state = 'paused';
      this._stopTick();
      this.emit('stateChange', { state: 'paused' });
    }
  }

  resume() {
    if (this.process && this.state === 'paused') {
      try { this.process.kill('SIGCONT'); } catch {}
      this.state = 'playing';
      this.startTime = Date.now();
      this._startTick();
      this.emit('stateChange', { state: 'playing' });
    }
  }

  stop() {
    if (this.process) {
      try { this.process.kill('SIGTERM'); } catch {}
      this.process = null;
    }
    this.state = 'stopped';
    this.position = 0;
    this.streamUrl = null;
    this._stopTick();
    this.emit('stateChange', { state: 'stopped' });
  }

  seek(position) {
    if (!this.streamUrl) return;

    const wasPlaying = this.state === 'playing';
    const wasPaused = this.state === 'paused';

    if (this.process) {
      try { this.process.kill('SIGTERM'); } catch {}
      this.process = null;
    }
    this._stopTick();

    const args = ['-nodisp', '-autoexit', '-loglevel', 'quiet', '-ss', String(position), this.streamUrl];
    this.process = spawn('ffplay', args, { stdio: 'ignore' });

    this.position = position;
    this.seekOffset = position;
    this.startTime = Date.now();

    if (wasPlaying) {
      this.state = 'playing';
      this._startTick();
    } else if (wasPaused) {
      this.state = 'paused';
      setTimeout(() => {
        if (this.process) {
          try { this.process.kill('SIGSTOP'); } catch {}
        }
      }, 150);
    } else {
      this.state = 'playing';
      this._startTick();
    }

    this.process.on('exit', (code) => {
      this._stopTick();
      this.state = 'stopped';
      this.emit('trackEnd', { code });
    });

    this.emit('stateChange', { state: this.state });
  }

  setVolume(level) {
    this.volume = Math.max(0, Math.min(100, Math.round(level)));
    const { exec } = require('child_process');
    exec(`pactl set-sink-volume @DEFAULT_SINK@ ${this.volume}%`, () => {
      if (this.volume === 0) {
        exec('amixer set Master mute', () => {});
      } else {
        exec(`amixer set Master ${this.volume}%`, () => {});
      }
    });
    this.emit('stateChange', { volume: this.volume });
  }

  getStatus() {
    return {
      state: this.state,
      title: this.title,
      artist: this.artist,
      coverUrl: this.coverUrl,
      position: this.position,
      volume: this.volume,
    };
  }

  _startTick() {
    this._stopTick();
    this._interval = setInterval(() => {
      if (this.state === 'playing') {
        this.position = this.seekOffset + (Date.now() - this.startTime) / 1000;
      }
    }, 1000);
  }

  _stopTick() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }
}

module.exports = new Player();
