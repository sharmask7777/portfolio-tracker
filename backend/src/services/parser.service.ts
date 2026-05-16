import { spawn } from 'child_process';
import path from 'path';

export class ParserService {
  private static pythonPath = path.join(__dirname, '../../venv/bin/python3');
  private static scriptPath = path.join(__dirname, '../../scripts/parse_cas.py');

  public static async parseCAS(filePath: string, password: string = ''): Promise<any> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.pythonPath, [this.scriptPath, filePath, password]);

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          console.error(`Python parser process exited with code ${code}`);
          console.error(`Stderr: ${stderr}`);
          try {
            const errorObj = JSON.parse(stderr);
            return reject(new Error(errorObj.error || 'Parsing failed'));
          } catch (e) {
            return reject(new Error(stderr || 'Python process exited with error'));
          }
        }

        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (e) {
          reject(new Error('Failed to parse Python output: ' + stdout));
        }
      });
    });
  }
}
