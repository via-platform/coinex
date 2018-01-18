const {Emitter, CompositeDisposable} = require('via');
// const _ = require('underscore-plus');
const axios = require('axios');

const Helpers = require('./helpers');
const url = 'https://api.coinex.com/v1';

module.exports = class Symbol {
    static all(){
        return axios.get(`https://www.coinex.com/res/market/status`).then(response => Object.entries(response.data.data));
    }

    constructor(params, websocket){
        const [symbol, data] = params;

        this.disposables = new CompositeDisposable();
        this.emitter = new Emitter();
        this.websocket = websocket;

        this.id = symbol;
        this.base = symbol.slice(0, -3);
        this.quote = 'BCH';
        this.name = `${this.base}-${this.quote}`;
        this.exchange = 'coinex';
        this.categories = ['CoinEx'];
        this.description = 'CoinEx';
        this.available = true;
        this.marginEnabled = false;

        this.identifier = 'COINEX:' + this.name;

        this.baseMinSize = 0;
        this.baseMaxSize = 0;
        this.baseIncrement = 0;
        this.basePrecision = 8;

        this.quoteMinPrice = 0;
        this.quoteMaxPrice = 0;
        this.quoteIncrement = 0;
        this.quotePrecision = 8;

        this.granularity = 60000; //Smallest candlestick size available
        this.precision = 8; //Number of decimal places to support
        this.minNotional = 0;

        this.aggregation = 2; //Number of decimal places to round to / group by for display purposes

        let last = data.last;

        while(!isNaN(last) && last > 0 && last < 1){
            this.aggregation++;
            last *= 10;
        }
    }

    data({granularity, start, end}){
        const interval = Helpers.timeframes[granularity];
        const params = {type: interval, market: this.id};

        //TODO, eventually implement a method to allow for a wider variety of time frames
        if(!interval) throw new Error('Invalid timeframe requested.');

        return axios.get(`${url}/market/kline`, {params}).then(response => response.data.data.map(Helpers.data))
    }

    history(){
        return axios.get(`${url}/aggTrades`, {params: {symbol: this.id}}).then(response => response.data.map(Helpers.history));
    }

    orderbook(callback){
        //Get the orderbook via an HTTP request and fire a snapshot event if we are still subscribed
        //TODO Check to make sure we're still subscribed before firing the callback to nowhere
        axios.get(`${url}/depth`, {params: {symbol: this.id}})
        .then(result => callback({type: 'snapshot', bids: result.data.bids, asks: result.data.asks}))
        .catch(() => {}); //TODO Somehow handle this error

        return this.websocket.subscribe(`${this.id.toLowerCase()}@depth`, message => {
            const changes = [];

            for(const bid of message.b) changes.push(['buy', bid[0], bid[1]]);
            for(const ask of message.a) changes.push(['sell', ask[0], ask[1]]);

            callback({type: 'update', changes});
        });
    }

    matches(callback){
        //TODO Verify ticker integrity by checking against the sequence number
        return this.websocket.subscribe(`${this.id.toLowerCase()}@aggTrade`, message => callback(Helpers.matches(message)));
    }

    ticker(callback){
        return this.websocket.subscribe(this.id, 'deals', message => callback(Helpers.ticker(message)));
    }
}
