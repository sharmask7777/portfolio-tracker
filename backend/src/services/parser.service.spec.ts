import { ParserService } from './parser.service';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

jest.mock('child_process');

describe('ParserService Logic', () => {
  it('should correctly parse successful Python output', async () => {
    const mockChild: any = new EventEmitter();
    mockChild.stdout = new EventEmitter();
    mockChild.stderr = new EventEmitter();
    
    (spawn as jest.Mock).mockReturnValue(mockChild);

    const promise = ParserService.parseCAS('test.pdf', 'password');

    // Simulate Python output
    mockChild.stdout.emit('data', JSON.stringify({ folios: [] }));
    mockChild.emit('close', 0);

    const result = await promise;
    expect(result).toEqual({ folios: [] });
  });

  it('should handle Python errors gracefully', async () => {
    const mockChild: any = new EventEmitter();
    mockChild.stdout = new EventEmitter();
    mockChild.stderr = new EventEmitter();
    
    (spawn as jest.Mock).mockReturnValue(mockChild);

    const promise = ParserService.parseCAS('test.pdf', 'wrong');

    // Simulate Python error
    mockChild.stderr.emit('data', JSON.stringify({ error: 'Incorrect password' }));
    mockChild.emit('close', 1);

    await expect(promise).rejects.toThrow('Incorrect password');
  });
});
