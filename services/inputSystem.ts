import { InputCommand, InputState } from '../types';

export class InputSystem {
  private currentState: InputState;

  constructor() {
    this.currentState = {
      [InputCommand.LEFT]: false,
      [InputCommand.RIGHT]: false,
      [InputCommand.JUMP]: false,
      [InputCommand.DOWN]: false,
      [InputCommand.DASH]: false,
      [InputCommand.ATTACK]: false,
    };
  }

  public init() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  public cleanup() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }

  public getState(): InputState {
    return { ...this.currentState };
  }

  // Virtual joystick / Touch support calls this
  public setCommand(command: InputCommand, isActive: boolean) {
    this.currentState[command] = isActive;
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    const command = this.mapKeysToCommand(e.code);
    if (command) {
      this.currentState[command] = true;
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    const command = this.mapKeysToCommand(e.code);
    if (command) {
      this.currentState[command] = false;
    }
  };

  private mapKeysToCommand(code: string): InputCommand | null {
    switch (code) {
      case 'ArrowLeft':
      case 'KeyA':
        return InputCommand.LEFT;
      case 'ArrowRight':
      case 'KeyD':
        return InputCommand.RIGHT;
      case 'Space':
      case 'KeyW':
      case 'ArrowUp':
        return InputCommand.JUMP;
      case 'ArrowDown':
      case 'KeyS':
        return InputCommand.DOWN;
      case 'ShiftLeft':
      case 'KeyK':
        return InputCommand.DASH;
      case 'KeyJ':
        return InputCommand.ATTACK;
      default:
        return null;
    }
  }
}