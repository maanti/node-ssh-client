import {InputParser} from "./InputParser";
import {Client} from "ssh2";
import readline from "readline";
import * as path from "path";

export class Connection {
    private readonly credentials: ILoginCredentials;
    private readonly privateKeyPath: string;
    private ignoreNext: boolean;
    private shellStream;
    private connection: Client;

    constructor(sshUrl: string) {
        this.credentials = InputParser.parseUrl(sshUrl);
        this.privateKeyPath = path.join(process.env.HOME, ".ssh/id_rsa");
    }

    public startSession() {
        return new Promise((resolve, reject) => {
            this.connection = new Client();

            this.connection.on("ready", () => {
                this.connection.shell((err, shellStream) => {
                    this.shellStream = shellStream;
                    if (err) {
                        reject(err);
                    }
                    const reader = readline.createInterface({
                        input: process.stdin,
                        output: process.stdout,
                        terminal: false
                    });

                    shellStream.on("close", () => {
                        this.connection.end();
                    }).on("data", (data) => {
                        this.handleShellOutput(data);
                    }).stderr.on("data", (data) => {
                        process.stderr.write(data);
                    });

                    reader.on("line", (line) => {
                        this.handleUserInput(line);
                    });
                });
            }).connect({
                host: this.credentials.host,
                port: this.credentials.port,
                username: this.credentials.login,
                privateKey: require("fs").readFileSync(this.privateKeyPath)
            });
        });
    }

    private handleShellOutput(data) {
        process.stdin.pause();
        if (!this.ignoreNext) {
            process.stdout.write(data);
        } else {
            const str = data.toString().substring(data.indexOf("\n") + 1);
            if (str) {
                process.stdout.write(str);
                this.ignoreNext = false;
            }
        }
        process.stdin.resume();
    }

    private handleUserInput(line) {
        const parsed = InputParser.parseCommand(line);
        if (parsed) {
            const {command, argument} = parsed;
            if (command === "get") {
                this.get(argument, process.cwd());
            }
        }
        if (!InputParser.parseCommand(line)) {
            this.ignoreNext = true;
            this.shellStream.write(line.trim() + "\n");
        }
    }

    private get(fromPath: string, toPath: string) {
        this.connection.sftp((err, sftp) => {
            if (err) {
                throw err;
            }
            console.log(`Downloading file from ${this.credentials.host}:${fromPath} to localhost:${toPath}`);
            const fileNameRegexp = /[-_\w]+[.][\w]+$/i;
            const fileName = fromPath.match(fileNameRegexp);
            toPath = path.join(toPath, fileName && fileName[0]);
            sftp.fastGet(fromPath, toPath, {}, (error) => {
                if (error) {
                    throw error;
                }
                console.log("File transferred");
                sftp.end();
            });
        });
    }

    private put(fromPath: string, toPath: string) {
        this.connection.sftp((err, sftp) => {
            if (err) {
                throw err;
            }
            console.log(`Uploading file from localhost:${fromPath} to ${this.credentials.host}:${toPath}`);
            const writeStream = sftp.createWriteStream(toPath);

            writeStream.on("close", () => {
                console.log("File transferred");
            });
        });
    }
}
