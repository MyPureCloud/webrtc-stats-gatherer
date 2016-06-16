/* global describe, it */

import { assert } from 'chai';
import StatsGatherer from '../src/StatsGatherer';

describe('StatsGatherer', function () {
  describe('constructor', function () {
    it('should accept options and initialize the class', function () {
      const pc = { on: function () { } };
      console.log(StatsGatherer);
      const gatherer = new StatsGatherer(pc);
      assert.equal(gatherer.connection, pc);
    });
  });
});
