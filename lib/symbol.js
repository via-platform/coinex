const {Emitter, CompositeDisposable} = require('via');
// const _ = require('underscore-plus');
const axios = require('axios');

const Helpers = require('./helpers');
const url = 'https://api.binance.com/api/v1';

module.exports = class Symbol {
    static all(){
        return axios.get(`${url}/exchangeInfo`).then(response => response.data.symbols);
    }

    constructor(params, websocket){
        this.disposables = new CompositeDisposable();
        this.emitter = new Emitter();
        this.websocket = websocket;

        this.id = params.symbol;
        this.name = `${params.baseAsset}-${params.quoteAsset}`;
        this.exchange = 'binance';
        this.categories = ['Binance'];
        this.description = 'Binance';
        this.available = (params.status === 'TRADING');
        this.marginEnabled = false;

        this.identifier = 'BINANCE:' + this.name;
        this.base = params.baseAsset;
        this.quote = params.quoteAsset;

        const base = params.filters.find(f => f.filterType === 'LOT_SIZE');
        const quote = params.filters.find(f => f.filterType === 'PRICE_FILTER');
        const notional = params.filters.find(f => f.filterType === 'MIN_NOTIONAL');

        this.baseMinSize = parseFloat(base.minQty);
        this.baseMaxSize = parseFloat(base.maxQty);
        this.baseIncrement = parseFloat(base.stepSize);
        this.basePrecision = params.basePrecision;

        this.quoteMinPrice = parseFloat(quote.minPrice);
        this.quoteMaxPrice = parseFloat(quote.maxPrice);
        this.quoteIncrement = parseFloat(quote.tickSize);
        this.quotePrecision = params.quotePrecision;

        this.granularity = 60000; //Smallest candlestick size available
        this.precision = 8; //Number of decimal places to support
        this.minNotional = parseFloat(notional.minNotional);

        this.aggregation = 0; //Number of decimal places to round to / group by for display purposes

        let tick = this.quoteIncrement;

        while(!isNaN(tick) && tick > 0 && tick < 1){
            this.aggregation++;
            tick *= 10;
        }
    }

    data({granularity, start, end}){
        const interval = Helpers.timeframes[granularity];
        const params = {startTime: start.getTime(), endTime: end.getTime(), interval, symbol: this.id};

        //TODO, eventually implement a method to allow for a wider variety of time frames
        if(!interval) throw new Error('Invalid timeframe requested.');

        return axios.get(`${url}/klines`, {params}).then(response => response.data.map(Helpers.data))
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
        return this.matches(callback);
    }
}
