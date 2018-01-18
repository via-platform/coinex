const {CompositeDisposable, Disposable, Emitter} = require('via');
const uri = 'wss://socket.coinex.com/';

module.exports = class Websocket {
    constructor(options = {}){
        this.status = 'disconnected';
        this.subscriptions = new Map(); //Channel => [Listeners]
        this.disposables = new CompositeDisposable();
        this.emitter = new Emitter();
        this.opened = false;
        this.interval = null;
        this.connection = null;
        this.id = 0;
    }

    connect(){
        if(!this.connection){
            this.connection = via.websockets.create(uri);
            this.disposables.add(this.connection.onDidOpen(this.open.bind(this)));
            this.disposables.add(this.connection.onDidClose(this.close.bind(this)));
            this.connection.onDidReceiveMessage(this.message.bind(this));
        }
    }

    disconnect(channel){
        // const connection = this.connections.get(channel);
        //
        // if(connection){
        //     via.websockets.destroy(connection);
        //     this.connections.delete(channel);
        //     this.subscriptions.delete(channel);
        //     this.emitter.emit('did-close');
        // }
    }

    open(){
        if(this.subscriptions.size){
            console.log('OPENED', this.subscriptions.size)
            for(const subscription of this.subscriptions.keys()){
                const [symbol, channel] = subscription.split('.');
                this.connection.send({method: `${channel}.subscribe`, params: [symbol], id: this.id++});
            }

            // if(this.account){
            //     Object.assign(subscribe, Helpers.sign(this.account.keys, 'GET', '/users/self/verify'));
            // }
        }else{
            via.websockets.destroy(connection);
            this.connection = null;
        }
    }

    close(){
        console.log('CLOSED')
        if(this.interval){
            clearInterval(this.interval);
        }
    }


    message(raw){
        return console.log(raw);
        const message = JSON.parse(raw);
        const [method, params, id] = message;

        if(!method || !params){
            return;
        }

        const [channel, action] = method;
        const [symbol, data] = params;
        const name = `${symbol}.${channel}`;

        if(this.subscriptions.has(name)){
            const subscriptions = this.subscriptions.get(name);

            for(const subscription of subscriptions){
                subscription(data);
            }
        }
    }

    subscribe(symbol, channel, callback){
        const name = `${symbol}.${channel}`;

        this.connect();

        if(!this.subscriptions.has(name)){
            this.subscriptions.set(name, []);
            this.connection.send({method: `${channel}.subscribe`, params: [symbol], id: this.id++});
        }

        this.subscriptions.get(name).push(callback);

        return new Disposable(() => this.unsubscribe(symbol, channel, callback));
    }

    unsubscribe(symbol, channel, callback){
        const name = `${symbol}.${channel}`;

        if(this.subscriptions.has(name)){
            const listeners = this.subscriptions.get(name);
            listeners.splice(listeners.indexOf(callback), 1);

            if(!listeners.length){
                this.subscriptions.delete(name);
            }

            if(!this.subscriptions.size){
                via.websockets.destroy(this.connection);
            }
        }
    }

    destroy(){
        if(this.connection){
            via.websockets.destroy(this.connection);
        }

        this.disposables.dispose();
        this.subscriptions = null;
        this.emitter.emit('did-destroy');
        this.emitter = null;
    }
}
