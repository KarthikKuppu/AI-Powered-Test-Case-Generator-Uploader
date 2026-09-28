const axios        = require('axios');
const { toADOSteps } = require('../../formatter');

class AdoProvider {
  constructor() {
    const ORG_URL = process.env.ADO_ORG_URL;
    const PROJECT = process.env.ADO_PROJECT;
    const PAT     = process.env.ADO_PAT;

    this.orgUrl  = ORG_URL;
    this.project = PROJECT;
    this.auth    = Buffer.from(`:${PAT}`).toString('base64');

    this.baseHeaders = {
      Authorization:  `Basic ${this.auth}`,
      'Content-Type': 'application/json',
    };
  }

  async getUserStory(workItemId) {
    const itemUrl     = `${this.orgUrl}/${this.project}/_apis/wit/workitems/${workItemId}?$expand=all&api-version=7.1`;
    const commentsUrl = `${this.orgUrl}/${this.project}/_apis/wit/workitems/${workItemId}/comments?api-version=7.1-preview.3`;

    const [itemRes, commentsRes] = await Promise.all([
      axios.get(itemUrl, { headers: this.baseHeaders }),
      axios.get(commentsUrl, { headers: this.baseHeaders }).catch(() => ({ data: { comments: [] } })),
    ]);

    const f        = itemRes.data.fields;
    const comments = commentsRes.data.comments || [];
    const discussion = comments
      .map(c => {
        const author = c.createdBy?.displayName || 'Unknown';
        const date   = new Date(c.createdDate).toLocaleDateString('en-GB');
        return `[${author} on ${date}]: ${c.text}`;
      })
      .join('\n\n');

    return {
      id:                 workItemId,
      title:              f['System.Title']                             || '',
      description:        f['System.Description']                       || '',
      acceptanceCriteria: f['Microsoft.VSTS.Common.AcceptanceCriteria'] || '',
      state:              f['System.State']                             || '',
      discussion:         discussion || '',
    };
  }

  async createTestCase(title, steps, description, areaPath) {
    const stepsXml = toADOSteps(steps);
    const url      = `${this.orgUrl}/${this.project}/_apis/wit/workitems/$Test%20Case?api-version=7.1`;

    const body = [
      { op: 'add', path: '/fields/System.Title',             value: title       },
      { op: 'add', path: '/fields/Microsoft.VSTS.TCM.Steps', value: stepsXml    },
      { op: 'add', path: '/fields/System.Description',       value: description },
    ];

    if (areaPath) {
      body.push({ op: 'add', path: '/fields/System.AreaPath', value: areaPath });
    }

    const res = await axios.post(url, body, {
      headers: {
        Authorization:  `Basic ${this.auth}`,
        'Content-Type': 'application/json-patch+json',
      },
    });

    return res.data.id;
  }

  async linkTestCaseToStory(testCaseId, storyId) {
    const url  = `${this.orgUrl}/${this.project}/_apis/wit/workitems/${testCaseId}?api-version=7.1`;
    const body = [
      {
        op:   'add',
        path: '/relations/-',
        value: {
          rel:        'Microsoft.VSTS.Common.TestedBy-Reverse',
          url:        `${this.orgUrl}/_apis/wit/workItems/${storyId}`,
          attributes: { comment: 'Linked by Test Case Agent' },
        },
      },
    ];

    await axios.patch(url, body, {
      headers: {
        Authorization:  `Basic ${this.auth}`,
        'Content-Type': 'application/json-patch+json',
      },
    });
  }
}

module.exports = AdoProvider;
