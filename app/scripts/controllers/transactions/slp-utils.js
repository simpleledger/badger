const BITBOXSDK = require('bitbox-sdk/lib/bitbox-sdk').default
const BITBOX = new BITBOXSDK()
const BigNumber = require('bignumber.js')

class SlpUtils {

    static get lokadIdHex() { return "534c5000" }

    static decodeMetadata(txDetails) {
        // txOut = {
        //     txid: 
        //     tx: {} //transaction details from bitbox object
        // }
        let out = {
            token: '',
            quantity: 0
        };

        const script = BITBOX.Script.toASM(Buffer.from(txDetails.vout[0].scriptPubKey.hex, 'hex')).split(' ');

        if (script[0] !== 'OP_RETURN') {
            throw new Error('Not an OP_RETURN');
        }

        if (script[1] !== this.lokadIdHex) {
            throw new Error('Not a SLP OP_RETURN');
        }

        if (script[2] != 'OP_1') { // NOTE: bitcoincashlib-js converts hex 01 to OP_1 due to BIP62.3 enforcement
            throw new Error('Unknown token type');
        }

        const type = Buffer.from(script[3], 'hex').toString('ascii').toLowerCase();

        if (type === 'genesis') {
            out.token = txDetails.txid;
            out.ticker = Buffer.from(script[4], 'hex').toString('ascii')
            out.name = Buffer.from(script[5], 'hex').toString('ascii')
            out.decimals = script[8].startsWith('OP_') ? parseInt(script[8].slice(3), 16) : parseInt(script[8], 16)
            out.quantity = new BigNumber(script[10], 16)
        } else {
            throw new Error('Invalid tx type');
        }

        return out;
    }

    static decodeTxOut(txOut) {
      // txOut = {
      //     txid: 
      //     tx: {} //transaction details from bitbox object
      // }
      let out = {
        token: '',
        quantity: 0,
        baton: false,
      }

      const vout = parseInt(txOut.vout)

      const script = BITBOX.Script.toASM(Buffer.from(txOut.tx.vout[0].scriptPubKey.hex, 'hex')).split(' ')

      if (script[0] !== 'OP_RETURN') {
        throw new Error('Not an OP_RETURN')
      }

      if (script[1] !== this.lokadIdHex) {
        throw new Error('Not a SLP OP_RETURN')
      }

      if (script[2] != 'OP_1') { // NOTE: bitcoincashlib-js converts hex 01 to OP_1 due to BIP62.3 enforcement
        throw new Error('Unknown token type')
      }

      const type = Buffer.from(script[3], 'hex').toString('ascii').toLowerCase()

      if (type === 'genesis') {
        if (typeof script[9] === 'string' && script[9].startsWith('OP_')) {
          script[9] = script[9].slice(3)
        }
        if (script[9] === 'OP_2' && vout === 2 || parseInt(script[9], 16) === vout) {
          out.token = txOut.txid
          out.baton = true
          return out
        }
        if (vout !== 1) {
          throw new Error('Not a SLP txout')
        }
        out.token = txOut.txid
        out.quantity = new BigNumber(script[10], 16)
      } else if (type === 'mint') {
        if (typeof script[5] === 'string' && script[5].startsWith('OP_')) {
          script[5] = script[5].slice(3)
        }
        if (script[5] === 'OP_2' && vout === 2 || parseInt(script[5], 16) === vout) {
          out.token = script[4]
          out.baton = true
          return out
        }

        if (txOut.vout !== 1) {
          throw new Error('Not a SLP txout')
        }
        out.token = script[4]

        if (typeof script[6] === 'string' && script[6].startsWith('OP_')) {
          script[6] = script[6].slice(3)
        }
        out.quantity = new BigNumber(script[6], 16)
      } else if (type === 'send') {
        if (script.length <= vout + 4) {
          throw new Error('Not a SLP txout')
        }

        out.token = script[4]

        if (typeof script[vout + 4] === 'string' && script[vout + 4].startsWith('OP_')) {
          script[vout + 4] = script[vout + 4].slice(3)
        }
        out.quantity = new BigNumber(script[vout + 4], 16)
      } else {
        throw new Error('Invalid tx type')
      }

      return out
  }
}

module.exports = SlpUtils