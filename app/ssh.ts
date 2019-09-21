import {Connection} from "./Connection";

async function start(): Promise<void> {
    const sshUrl: string = process.argv[2];
    if (!sshUrl) {
        console.log("Please, provide SSH URL (username@hostname[:port])");
        return;
    }
    const connection: Connection = new Connection(sshUrl);
    await connection.startSession();
}


start()
    .then(() => {
        process.exit(0);
    })
    .catch((err) => {
        console.error(err);
        process.exit(-1);
    });
