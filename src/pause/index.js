import React from 'react';
import { Component } from 'react';
import { PsxSettingsEditor } from './settings';

import {
  GamepadControlsTab,
  GamepadAnalogControlsTab,
  KeyboardControlsTab,
} from './controls';

import {
  CustomPauseScreen,
  EditorScreen,
  GamepadWhiteImage,
  KeyboardWhiteImage,
  PauseScreenButton,
  Resources,
  SettingsAppWhiteImage,
  TEXT_IDS,
} from '@webrcade/app-common';

export class EmulatorPauseScreen extends Component {
  constructor() {
    super();
    this.state = {
      mode: this.ModeEnum.PAUSE,
    };
  }

  ModeEnum = {
    PAUSE: 'pause',
    CONTROLS: 'controls',
    PSX_SETTINGS: 'psx-settings',
  };

  ADDITIONAL_BUTTON_REFS = [React.createRef(), React.createRef()];

  render() {
    const { ADDITIONAL_BUTTON_REFS, ModeEnum } = this;
    const {
      appProps,
      closeCallback,
      emulator,
      exitCallback,
      isEditor,
      isStandalone,
    } = this.props;
    const { mode } = this.state;

    const analog = emulator.getAnalogMode();
    const gamepad = analog ? (
      <GamepadAnalogControlsTab />
    ) : (
      <GamepadControlsTab />
    );
    const gamepadLabel = analog
      ? Resources.getText(
          TEXT_IDS.GAMEPAD_CONTROLS_DETAIL,
          Resources.getText(TEXT_IDS.ANALOG),
        )
      : Resources.getText(TEXT_IDS.GAMEPAD_CONTROLS);

    return (
      <>
        {mode === ModeEnum.PAUSE ? (
          <CustomPauseScreen
            appProps={appProps}
            closeCallback={closeCallback}
            exitCallback={exitCallback}
            isEditor={isEditor}
            isStandalone={isStandalone}
            additionalButtonRefs={ADDITIONAL_BUTTON_REFS}
            additionalButtons={[
              <PauseScreenButton
                imgSrc={GamepadWhiteImage}
                buttonRef={ADDITIONAL_BUTTON_REFS[0]}
                label={Resources.getText(TEXT_IDS.VIEW_CONTROLS)}
                onHandlePad={(focusGrid, e) =>
                  focusGrid.moveFocus(e.type, ADDITIONAL_BUTTON_REFS[0])
                }
                onClick={() => {
                  this.setState({ mode: ModeEnum.CONTROLS });
                }}
              />,
              <PauseScreenButton
                imgSrc={SettingsAppWhiteImage}
                buttonRef={ADDITIONAL_BUTTON_REFS[1]}
                label="PlayStation Settings"
                onHandlePad={(focusGrid, e) =>
                  focusGrid.moveFocus(e.type, ADDITIONAL_BUTTON_REFS[1])
                }
                onClick={() => {
                  this.setState({ mode: ModeEnum.PSX_SETTINGS });
                }}
              />,
            ]}
          />
        ) : null}
        {mode === ModeEnum.CONTROLS ? (
          <EditorScreen
            onClose={closeCallback}
            tabs={[
              {
                image: GamepadWhiteImage,
                label: gamepadLabel,
                content: gamepad,
              },
              {
                image: KeyboardWhiteImage,
                label: Resources.getText(TEXT_IDS.KEYBOARD_CONTROLS),
                content: <KeyboardControlsTab />,
              },
            ]}
          />
        ) : null}
        {mode === ModeEnum.PSX_SETTINGS ? (
          <PsxSettingsEditor emulator={emulator} onClose={closeCallback} />
        ) : null}
      </>
    );
  }
}
