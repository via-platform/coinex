const Socket = require('ws');
const {CompositeDisposable, Disposable, Emitter} = require('via');
const SocketURI = 'wss://stream.binance.com:9443/ws';

module.exports = class Websocket {
    constructor(options = {}){
        this.status = 'disconnected';
        this.subscriptions = new Map(); //Channel => [Listeners]
        this.connections = new Map(); //Channel => Websocket
        this.disposables = new CompositeDisposable();
        this.emitter = new Emitter();
        this.opened = false;
        this.interval = null;

        return this;
    }

    connect(channel){
        if(!this.connections.has(channel)){
            const connection = via.websockets.create(`${SocketURI}/${channel}`);
            connection.onDidReceiveMessage(e => this.message(channel, e));

            this.connections.set(channel, connection);
            this.subscriptions.set(channel, []);
        }
    }

    disconnect(channel){
        const connection = this.connections.get(channel);

        if(connection){
            via.websockets.destroy(connection);
            this.connections.delete(channel);
            this.subscriptions.delete(channel);
            this.emitter.emit('did-close');
        }
    }

    message(channel, data){
        if(this.subscriptions.has(channel)){
            const message = JSON.parse(data);
            const subscriptions = this.subscriptions.get(channel);

            for(let subscription of subscriptions){
                subscription(message);
            }
        }
    }

    subscribe(channel, callback){
        if(!this.subscriptions.has(channel)){
            this.connect(channel);
        }

        this.subscriptions.get(channel).push(callback);
        return new Disposable(() => this.unsubscribe(channel, callback));
    }

    unsubscribe(channel, callback){
        if(this.subscriptions.has(channel)){
            const listeners = this.subscriptions.get(channel);
            listeners.splice(listeners.indexOf(callback), 1);

            if(!listeners.length){
                this.disconnect(channel);
            }
        }
    }

    destroy(){
        for(const connection of this.connections.values()){
            via.websockets.destroy(connection);
        }

        this.disposables.dispose();
        this.subscriptions = null;
        this.emitter.emit('did-destroy');
        this.emitter = null;
    }
}
