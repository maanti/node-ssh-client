import {Connection} from "./Connection";
import minimist from "minimist";

async function start(): Promise<void> {
    let sshUrl: string;
    let forwardRule: string;
    const args = minimist(process.argv.slice(2));
    if (process.argv.length > 3) {
        // ssh.js user@host[:port] -L [host1:]port1:host2:port2
        forwardRule = args.L;
        sshUrl = process.argv[4];
    } else {
        // ssh.js user@host[:port]
        sshUrl = process.argv[2];
    }
    if (!sshUrl) {
        console.log("Please, provide SSH URL (username@hostname[:port])");
        return;
    }
    const connection: Connection = new Connection(sshUrl, forwardRule);
    if (forwardRule) {
        await connection.forward();
    } else {
        await connection.startInteractiveSession();
    }
}

(async () => {
    try {
        await start();
        process.exit(0);
    } catch (e) {
        console.log(e);
        process.exit(-1);
    }
})();
