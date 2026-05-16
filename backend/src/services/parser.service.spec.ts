import { ParserService } from './parser.service';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

describe('ParserService', () => {
  it('should parse CAS and return JSON result', async () => {
    const mockStdout = new EventEmitter();
    const mockStderr = new EventEmitter();
    const mockChild: any = new EventEmitter();
    mockChild.stdout = mockStdout;
    mockChild.stderr = mockStderr;

    (spawn as jest.Mock).mockReturnValue(mockChild);

    const promise = ParserService.parseCAS('dummy.pdf', 'password');

    mockStdout.emit('data', JSON.stringify({ investor_info: { name: 'John Doe' } }));
    mockChild.emit('close', 0);

    const result = await promise;
    expect(result.investor_info.name).toBe('John Doe');
  });

  it('should reject on non-zero exit code', async () => {
    const mockStdout = new EventEmitter();
    const mockStderr = new EventEmitter();
    const mockChild: any = new EventEmitter();
    mockChild.stdout = mockStdout;
    mockChild.stderr = mockStderr;

    (spawn as jest.Mock).mockReturnValue(mockChild);

    const promise = ParserService.parseCAS('dummy.pdf', 'password');

    mockStderr.emit('data', JSON.stringify({ error: 'Invalid password' }));
    mockChild.emit('close', 1);

    await expect(promise).rejects.toThrow('Invalid password');
  });
});
