import {
  registerAudioResume,
  settings,
  AppWrapper,
  Controller,
  Controllers,
  DefaultKeyCodeToControlMapping,
  DisplayLoop,
  Resources,
  CIDS,
  LOG,
  TEXT_IDS
} from '@webrcade/app-common';

export class Emulator extends AppWrapper {

  INP_LEFT = 1;
  INP_RIGHT = 1 << 1;
  INP_UP = 1 << 2;
  INP_DOWN = 1 << 3;
  INP_START = 1 << 4;
  INP_SELECT = 1 << 5;
  INP_A = 1 << 6;
  INP_B = 1 << 7;
  INP_X = 1 << 8;
  INP_Y = 1 << 9;
  INP_LBUMP = 1 << 10;
  INP_LTRIG = 1 << 11;
  INP_LTHUMB = 1 << 12;
  INP_RBUMP = 1 << 13;
  INP_RTRIG = 1 << 14;
  INP_RTHUMB = 1 << 15;
  CONTROLLER_COUNT = 4;

  OPT1 = 1;
  OPT2 = 1 << 1;

  constructor(app, debug = false) {
    super(app, debug);

    window.emulator = this;
    window.readyAudioContext = null;

    this.romBytes = null;
    this.biosBuffers = null;
    this.escapeCount = -1;
    this.audioPlaying = false;
    this.analogMode = this.getProps().analog;
    this.saveStatePath = null;

    LOG.info("## Initial analog mode: " + this.analogMode);
  }

  RA_DIR = '/home/web_user/retroarch/';
  RA_SYSTEM_DIR = this.RA_DIR + 'system/';
  ROM = this.RA_DIR + 'game.chd';

  SLOT0_NAME = 'game.srm';
  SLOT1_NAME = 'game.1.mcr';
  SAVE_NAME = 'sav';

  setRoms(uid, frontendArray, biosBuffers, romBytes) {
    this.uid = uid;
    this.frontendArray = frontendArray;
    this.biosBuffers = biosBuffers;
    this.romBytes = romBytes;
  }

  createControllers() {
    return new Controllers([
      new Controller(new DefaultKeyCodeToControlMapping()),
      new Controller(),
      new Controller(),
      new Controller(),
    ]);
  }

  createAudioProcessor() {
    return null;
  }

  async onShowPauseMenu() {
    await this.saveState();
  }

  async saveState() {
    const { saveStatePath, started } = this;
    const { FS, Module } = window;

    try {
      if (!started) {
        return;
      }

      // Save to files
      Module._cmd_savefiles();

      let files = [];

      const slot0 = `/home/web_user/retroarch/userdata/saves/${this.SLOT0_NAME}`
      const slot0Save = FS.readFile(slot0);
      const slot1 = `/home/web_user/retroarch/userdata/saves/${this.SLOT1_NAME}`
      const slot1Save = FS.readFile(slot1);

      if (slot0Save || slot1Save) {
        if (slot0Save) {
          LOG.info('found slot0 file.');
          files.push({
            name: this.SLOT0_NAME,
            content: slot0Save,
          });
        }
        if (slot1Save) {
          LOG.info('found slot1 file.');
          files.push({
            name: this.SLOT1_NAME,
            content: slot1Save,
          });
        }

        if (await this.getSaveManager().checkFilesChanged(files)) {
          LOG.info('saving state.');

          await this.getSaveManager().save(
            saveStatePath,
            files,
            this.saveMessageCallback,
          );
        }
      }
    } catch (e) {
      LOG.error('Error persisting save state: ' + e);
    }
  }

  async loadState() {
    const { saveStatePath } = this;
    const { FS } = window;

    // Write the save state (if applicable)
    try {

      const slot0 = `/home/web_user/retroarch/userdata/saves/${this.SLOT0_NAME}`
      const slot0Res = FS.analyzePath(slot0, true);
      const slot1 = `/home/web_user/retroarch/userdata/saves/${this.SLOT1_NAME}`
      const slot1Res = FS.analyzePath(slot1, true);

      if (!slot0Res.exists && !slot1Res.exists) {
        // Load
        const files = await this.getSaveManager().load(
          saveStatePath,
          this.loadMessageCallback,
        );

        if (files) {
          for (let i = 0; i < files.length; i++) {
            const f = files[i];
            if (f.name === this.SLOT0_NAME) {
              LOG.info('writing slot0 file');
              FS.writeFile(slot0, f.content);
            }
            if (f.name === this.SLOT1_NAME) {
              LOG.info('writing slot1 file');
              FS.writeFile(slot1, f.content);
            }
          }

          // Cache the initial files
          await this.getSaveManager().checkFilesChanged(files);
        }
      }
    } catch (e) {
      LOG.error('Error loading save state: ' + e);
    }
  }

  pollControls() {
    const { analogMode, CONTROLLER_COUNT, controllers } = this;

    controllers.poll();

    const isAnalog = analogMode;

    for (let i = 0; i < CONTROLLER_COUNT; i++) {
      let input = 0;

      // Hack to reduce likelihood of accidentally bringing up menu
      if (
        controllers.isControlDown(0 /*i*/, CIDS.ESCAPE) &&
        (this.escapeCount === -1 || this.escapeCount < 60)
      ) {
        if (this.pause(true)) {
          controllers
            .waitUntilControlReleased(0 /*i*/, CIDS.ESCAPE)
            .then(() => this.showPauseMenu());
          return;
        }
      }

      if (controllers.isControlDown(i, CIDS.UP, !isAnalog)) {
        input |= this.INP_UP;
      } else if (controllers.isControlDown(i, CIDS.DOWN, !isAnalog)) {
        input |= this.INP_DOWN;
      }
      if (controllers.isControlDown(i, CIDS.RIGHT, !isAnalog)) {
        input |= this.INP_RIGHT;
      } else if (controllers.isControlDown(i, CIDS.LEFT, !isAnalog)) {
        input |= this.INP_LEFT;
      }
      if (controllers.isControlDown(i, CIDS.START)) {
        input |= this.INP_START;
      }
      if (controllers.isControlDown(i, CIDS.SELECT)) {
        input |= this.INP_SELECT;
      }
      if (controllers.isControlDown(i, CIDS.A)) {
        input |= this.INP_A;
      }
      if (controllers.isControlDown(i, CIDS.B)) {
        input |= this.INP_B;
      }
      if (controllers.isControlDown(i, CIDS.X)) {
        input |= this.INP_X;
      }
      if (controllers.isControlDown(i, CIDS.Y)) {
        input |= this.INP_Y;
      }
      if (controllers.isControlDown(i, CIDS.LBUMP)) {
        input |= this.INP_LBUMP;
      }
      if (controllers.isControlDown(i, CIDS.RBUMP)) {
        input |= this.INP_RBUMP;
      }
      if (controllers.isControlDown(i, CIDS.LTRIG)) {
        input |= this.INP_LTRIG;
      }
      if (controllers.isControlDown(i, CIDS.RTRIG)) {
        input |= this.INP_RTRIG;
      }
      if (controllers.isControlDown(i, CIDS.LANALOG)) {
        input |= this.INP_LTHUMB
      }
      if (controllers.isControlDown(i, CIDS.RANALOG)) {
        input |= this.INP_RTHUMB
      }

      const analog0x = controllers.getAxisValue(i, 0, true);
      const analog0y = controllers.getAxisValue(i, 0, false);
      const analog1x= controllers.getAxisValue(i, 1, true);
      const analog1y = controllers.getAxisValue(i, 1, false);

      window.Module._wrc_set_input(
        i,
        input,
        analog0x,
        analog0y,
        analog1x,
        analog1y,
      );
    }
  }

  loadEmscriptenModule(canvas) {
    const {
      app,
      frontendArray,
      RA_DIR,
    } = this;

    return new Promise((resolve, reject) => {
      window.Module = {
        canvas: canvas,
        noInitialRun: true,
        onAbort: (msg) => app.exit(msg),
        onExit: () => app.exit(),
        onRuntimeInitialized: () => {
          const f = () => {
            // Enable show message
            this.setShowMessageEnabled(true);
            if (window.readyAudioContext) {
              if (window.readyAudioContext.state !== 'running') {
                app.setShowOverlay(true);
                registerAudioResume(
                  window.readyAudioContext,
                  (running) => {
                    if (running) {
                      window.Module._rwebaudio_enable();
                      window.Module._cmd_audio_reinit();
                      this.audioPlaying = true;
                    }
                    setTimeout(() => app.setShowOverlay(!running), 50);
                  },
                  500,
                );
              } else {
                window.Module._rwebaudio_enable();
                window.Module._cmd_audio_reinit();
                this.audioPlaying = true;
              }
            } else {
              setTimeout(f, 1000);
            }
          };
          setTimeout(f, 1000);
          resolve();
        },
        preInit: function () {
          const FS = window.FS;

          // Load the frontend resources
          const BrowserFS = window.BrowserFS;

          if (frontendArray) {
            const mfs = new BrowserFS.FileSystem.MountableFileSystem();
            const frontend = new BrowserFS.FileSystem.ZipFS(
              new Buffer.from(frontendArray),
            );
            mfs.mount(RA_DIR + 'bundle', frontend);
            BrowserFS.initialize(mfs);
            const BFS = new BrowserFS.EmscriptenFS();
            FS.mount(BFS, { root: '/home' }, '/home');
          } else {
            FS.mkdir('/home/web_user/retroarch');
          }
          FS.mkdir('/home/web_user/retroarch/system');
          FS.mkdir('/home/web_user/retroarch/userdata');
          FS.mkdir('/home/web_user/retroarch/userdata/system');
          FS.mkdir('/home/web_user/retroarch/userdata/saves');
        },
      };

      const script = document.createElement('script');
      document.body.appendChild(script);
      script.src = 'js/mednafen_psx_libretro.js';
    });
  }

  onPause(p) {
    if (!p) {
      if (window.readyAudioContext) {
        window.readyAudioContext.resume();
        console.log(window.readyAudioContext);
        window.Module._rwebaudio_enable();
        window.Module._cmd_audio_reinit();
      }
    }
  }

  wait(time) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve();
      }, time);
    });
  }

  applyGameSettings() {
    const { Module } = window;

    const props = this.getProps();

    let options = 0;
    // multi-tap
    if (props.multitap) {
      LOG.info("## multitap on");
      options |= this.OPT1;
    }
    // analog
    if (this.analogMode) {
      LOG.info("## analog on");
      options |= this.OPT2;
    }
    Module._wrc_set_options(options);
  }

  setAnalogMode(analog) {
    const isAnalog = (analog === 1);
    LOG.info("## Game setAnalogMode: " + isAnalog);
    this.analogMode = isAnalog;
    this.applyGameSettings();
  }

  async onStart(canvas) {
    const { app, debug, ROM } = this;
    const { FS, Module } = window;

    try {
      this.canvas = canvas;

      if (this.romBytes.byteLength === 0) {
        throw new Error('The size is invalid (0 bytes).');
      }

      // Apply the game settings
      this.applyGameSettings();

      // Copy BIOS files
      for (let bios in this.biosBuffers) {
        const bytes = this.biosBuffers[bios];
        const path = '/home/web_user/retroarch/userdata/system/' + bios;
        FS.writeFile(path, bytes);
      }

      // Write rom file
      FS.writeFile(ROM, this.romBytes);
      this.romBytes = null;

      await this.wait(2000);

      // Load the save state
      this.saveStatePath = app.getStoragePath(`${this.uid}/${this.SAVE_NAME}`);
      await this.loadState();

      // const start = Date.now();
      // const hashFile = Module.cwrap('hash_generate_from_file', 'null', ['number', 'string']);
      // hashFile(28, ROM);
      // alert("### hashTime: " + (Date.now() - start) / 1000.0);

      await this.wait(10000);

      //window.readyAudioContext = new window.AudioContext({sampleRate: 19200});
      window.readyAudioContext = new window.AudioContext();
      window.readyAudioContext.resume();
      console.log(window.readyAudioContext);

      try {
        //Module.callMain();
        Module.callMain(['-v', ROM]);
        //Module.resumeMainLoop();
      } catch (e) {
        LOG.error(e);
      }

      // Bilinear filter
      if (settings.isBilinearFilterEnabled()) {
        // TODO: Figure out a way to do this without re-init of video
        await this.wait(1000);
        Module._wrc_enable_bilinear_filter(1);
      }

      setTimeout(() => {
        app.setState({ loadingMessage: null });
      }, 50);

      this.displayLoop = new DisplayLoop(
        60,    // frame rate (ignored due to no wait)
        true, // vsync
        debug, // debug
        true, // force native
        false,  // no wait
      );
      this.displayLoop.setAdjustTimestampEnabled(false);

      Module.setCanvasSize(canvas.offsetWidth, canvas.offsetHeight);
      window.onresize = () => {
        Module.setCanvasSize(canvas.offsetWidth, canvas.offsetHeight);
      };

      let exit = false;

      // Start the display loop
      this.displayLoop.start(() => {
        try {
          if (!exit) {
            this.pollControls();
            Module._emscripten_mainloop();
          }
        } catch (e) {
          if (e.status === 1971) {
            // Menu was displayed, should never happen (bad rom?)
            app.exit(Resources.getText(TEXT_IDS.ERROR_UNKNOWN));
            exit = true;
          }
        }
      });;

    } catch (e) {
      LOG.error(e);
      app.exit(e);
    }
  }
}
