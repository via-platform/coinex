const crypto = require('crypto');
const axios = require('axios');
const url = 'https://api.coinex.com/v1';

const Helpers = {
    timeframes: {
        6e4: '1min',
        18e4: '3min',
        3e5: '5min',
        9e5: '15min',
        18e5: '30min',
        36e5: '1hour',
        72e5: '2hour',
        144e5: '4hour',
        216e5: '6hour',
        432e5: '12hour',
        864e5: '1day',
        2592e5: '3day',
        6048e5: '1week'
    },
    key: config => {
        if(!config.apiKey || !config.apiSecret){
            throw new Error('Missing a required parameter. API key and secret are both required fields.');
        }

        return JSON.stringify([config.apiKey, config.apiSecret]);
    },
    sign: ({key, secret}, data = {}) => {
        // debugger;
        data.timestamp = Date.now();
        const query = Object.entries(data).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
        data.signature = crypto.createHmac('sha256', secret).update(query).digest('hex');

        return data;
    },
    request: (keys, method, path, data) => {
        const signed = Helpers.sign(keys, data);

        return axios({
            method,
            url: url + path,
            params: signed,
            headers: {
                'X-MBX-APIKEY': keys.key
            }
        });
    },
    status: status => {
        if(['NEW', 'PARTIALLY_FILLED'].includes(status)){
            return 'working';
        }

        return status.toLowerCase();
    },
    data: d => ({date: new Date(d[0] * 1000), open: parseFloat(d[1]), close: parseFloat(d[2]), high: parseFloat(d[3]), low: parseFloat(d[4]), volume: parseFloat(d[5])}),
    ticker: d => ({date: new Date(), price: d[1]}),
    position: d => ({balance: parseFloat(d.balance), hold: parseFloat(d.hold)}),
    matches: d => ({date: new Date(d.E), price: parseFloat(d.p), size: parseFloat(d.q), side: d.m ? 'sell' : 'buy', id: d.a}),
    history: d => ({date: new Date(d.T), price: parseFloat(d.p), size: parseFloat(d.q), side: d.m ? 'sell' : 'buy', id: d.a}),
    symbol: id => via.symbols.findByExchange('binance').filter(s => s.id === id)
};

module.exports = Helpers;
