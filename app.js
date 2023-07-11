const net = require('node:net');
const dgram = require('node:dgram');

const serverTCP = new net.Server();
const serverUDP = new dgram.createSocket('udp4');

const admin = require('firebase-admin');
admin.initializeApp({
    credential: admin.credential.cert('./serviceAccountKey.json'),
    databaseURL: "https://ifba-portoseguro.firebaseio.com"
});

const fs = require('fs');
const db = admin.firestore();
const uuidFile = require('./uuid');
const ping = require('ping');
const address = require('address');

let data = [];
let laboratory = null;
let clients = [];

const deactivateAllComputers = new Promise((resolve) => {
    const collection = db.collectionGroup('computers');
    collection
        .get()
        .then(querySnapshot => {
            if (querySnapshot.empty){
                console.log('Disabling all computers....');
                return resolve('No computers found to disable!');
            } else {
                console.log('Disabling all computers...');
                querySnapshot.forEach(doc => {
                    console.log('UUID:', doc.id, '- Disabled');
                    doc.ref.set({active: false}, {merge: true})
                        .then(() => resolve('Disabled computers OK'))
                        .catch(error => {
                            console.error("Error updating document: ", error);
                        });
                });
            }
        })
        .catch(error => {
            console.log("Error getting document:", error);
        });
});
const IsJsonString = str => {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    data = JSON.parse(str)
    return true;
};
const findUUID = uuid => {
    laboratory = null;
    uuidFile.laboratory.maintenance.map(res => {
        if (res === uuid){
            laboratory = 'n8xca2iUgarDgt9nB9Pj';
        }
    });
    uuidFile.laboratory.network.map(res => {
        if (res === uuid){
            laboratory = 'P1gszuFncdbxhh1L6ND7';
        }
    });
    uuidFile.laboratory.computing01.map(res => {
        if (res === uuid){
            laboratory = '4rm0ZtPl0h5Eu9NrjqEx';
        }
    });
    uuidFile.laboratory.computing02.map(res => {
        if (res === uuid){
            laboratory = 'g7c61BZS0pkqpto95ZjD';
        }
    });
    uuidFile.laboratory.computing03.map(res => {
        if (res === uuid){
            laboratory = 'm3EFlFm5iuyv6FzFzWOK';
        }
    });
    uuidFile.laboratory.computing04.map(res => {
        if (res === uuid){
            laboratory = '7clCLJ2n6eTVQw7FQESc';
        }
    });
    return laboratory;
};
const setComputer = (data, laboratory) => {
    data['active'] = true;
    db
        .collection('laboratories')
        .doc(laboratory)
        .collection('computers')
        .doc(data.system['uuid'])
        .set(data, {merge: true})
        .then(() => {
            console.log("Document successfully written!");
        } )
        .catch(error => {
            console.error("Error writing document: ", error);
        });
};
const offComputer = async (uuid, i) => {
    const querySnapshot = await db
        .collectionGroup('computers')
        .where('system.uuid', '==', `${uuid}`)
        .get();
    querySnapshot.docChanges()
        .map(res => {
            res.doc.ref.update({active: false})
                .then(() => {
                    console.log("Document successfully written!");
                })
                .catch(error => console.error("Error writing document: ", error))
        });
};
const enableServerTCP = (ip) => {
    console.log(`${(new Date().toString())}`);
    serverTCP.listen(11111, `${ip}`);
    serverTCP.on('listening', () => {
        console.log(`\nServer TCP listening\nAddress: ${serverTCP.address().address} - Port: ${serverTCP.address().port}`);
        enableServerUDP();
    });
    serverTCP.on('connection', socket => {
        let jsonCheck = '';
        socket.setKeepAlive(true, 5000);
        socket.on('data', chunk => {
            jsonCheck += chunk.toString();
            if (IsJsonString(jsonCheck)) {
                if (data.type === 'static') {
                    data.system['uuid'] = data.system['uuid'].toUpperCase();
                    laboratory = findUUID(data.system['uuid']);
                    if (laboratory === null) {
                        fs.appendFileSync(
                            'NOTFOUND.txt',
                            `\n${data.system['model']} - ${data.system['serial']} - ${data.system['uuid']}`
                        );
                        console.log(`${
                            (new Date().toLocaleString('pt-BR', { timeZone: 'America/Bahia' }))
                        } - UUID: ${
                            data.system['uuid']
                        } - HOST: ${ socket.localAddress } - Rejected`);
                        socket.write(JSON.stringify('true'));
                        socket.destroy();
                    } else {
                        console.log(`${
                            (new Date().toLocaleString(
                                    'pt-BR', { timeZone: 'America/Bahia' }
                                )
                            )
                        } - UUID: ${
                            data.system['uuid']
                        } - HOST: ${ socket.remoteAddress } - Connected`);
                        clients.push({ip: socket.remoteAddress, laboratory: laboratory, uuid: data.system['uuid']});
                        setComputer(data, laboratory);
                    }
                }
                if (data.type === 'dynamic') {
                    data.uuid = data.uuid.toUpperCase();
                    fs.writeFile(
                        `dynamic_data/${data.uuid}.json`,
                        `${JSON.stringify(data, null, '\t')}`,
                        err => {
                            if (err) throw err;
                            console.log('Saved!'+ data.uuid);
                        });
                }
            }
        });
        socket.on('error', (err) => {
            console.log('SOCKET ERROR :( '+ err);
        });
        socket.on('end', () => {
            console.log('SOCKET END!');
        });
        socket.on('close', () => {
            console.log('SOCKET CLOSE!');
            clients.forEach((host, i) => {
                ping.sys.probe(`${host.ip}`, (isAlive) => {
                    if (!isAlive) {
                        console.log(`${ (new Date().toLocaleString('pt-BR', { timeZone: 'America/Bahia' }))} - UUID: ${host.uuid} - HOST: ${ host.ip } - Disconnected`);
                        console.log('remove: '+i);
                        clients.splice(i,1);
                        offComputer(host.uuid, i).then().catch();
                    } else {console.log('ISALIVE: '+isAlive+' - '+i+' - '+host.ip)}
                }, { timeout: 10 })
            });
        });
    });
    serverTCP.on('close', () => {
        console.log('SERVER CLOSED!');
    });
    serverTCP.on('error', (err) => {
        console.log('ERROR SERVER :( '+ err)
    });

};
const enableServerUDP = () => {
    serverUDP.on('listening', () => {
        console.log(`\nServer UDP listening\nAddress: ${serverUDP.address().address} - Port: ${serverUDP.address().port} `);
    });
    serverUDP.on('message',(msg, client) => {
        console.log(client);
        serverUDP.send( ``, 0, 0, client.port, client.address);
    });
    serverUDP.on('error', (err) => {
        console.error(`server error:\n${err.stack}`);
        serverUDP.close();
    });
    serverUDP.bind(22222);
}
deactivateAllComputers.then((res) => {
    console.log(res);
    enableServerTCP(address.ip());
});
