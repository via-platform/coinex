const crypto = require('crypto');
const axios = require('axios');
const url = 'https://api.binance.com';

const Helpers = {
    timeframes: {
        6e4: '1m',
        18e4: '3m',
        3e5: '5m',
        9e5: '15m',
        18e5: '30m',
        36e5: '1h',
        72e5: '2h',
        144e5: '4h',
        216e5: '6h',
        288e5: '8h',
        432e5: '12h',
        864e5: '1d',
        2592e5: '3d',
        6048e5: '1w',
        2628e6: '1M'
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
    data: d => ({date: new Date(d[0]), open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4]), volume: parseFloat(d[5])}),
    position: d => ({balance: parseFloat(d.balance), hold: parseFloat(d.hold)}),
    matches: d => ({date: new Date(d.E), price: parseFloat(d.p), size: parseFloat(d.q), side: d.m ? 'sell' : 'buy', id: d.a}),
    history: d => ({date: new Date(d.T), price: parseFloat(d.p), size: parseFloat(d.q), side: d.m ? 'sell' : 'buy', id: d.a}),
    symbol: id => via.symbols.findByExchange('binance').filter(s => s.id === id)
};

module.exports = Helpers;
