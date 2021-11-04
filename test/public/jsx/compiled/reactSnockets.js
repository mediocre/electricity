var Include = React.createClass({
  displayName: "Include",
  render: function () {
    return /*#__PURE__*/React.createElement("h1", null, "This got included!");
  }
}); //= require reactInclude.js

React.render( /*#__PURE__*/React.createElement(Include, null), document.body);