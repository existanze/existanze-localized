module.exports = {
  extend: 'apostrophe-pieces',
  name: 'localizedDocument',
  label: 'Localized Document',
  pluralLabel: 'Localized Documents',
  alias: 'localized',
  addFields:[
    {

      name:'locale',
      label:'Locale',
      type:'string'
    },
    {

      name:'docId',
      label:'Document ID',
      type:'string'
    }


  ]

};