var Include = React.createClass({displayName: "Include",
    render: function() {
        return (
            React.createElement("h1", null, "This got included!")
        );
    }
});

//= require reactInclude.js

React.render(React.createElement(Include, null), document.body);
