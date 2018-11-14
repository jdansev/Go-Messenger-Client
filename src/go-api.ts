


class GoManager {

    ws: any;
    hubSearchWS: any;

    username: string;
    id: string;
    token: string;

    api_manager: APIManager;

    constructor() {
        this.api_manager = new APIManager();
    }

    public initialise() {
        var self: any = this;

        $("#hub-search").keyup(function(e) {

            if ($('#hub-search').val() == '') {
                tabManager.resetHubTab();
                return;
            }

            if (self.hubSearchWS == null || self.hubSearchWS.readyState != self.hubSearchWS.OPEN) {
                console.log('you are not connected.');
                self.connectHubSearchWebsocket();
            }

            self.waitForSocketConnection(self.hubSearchWS, function() {
                self.hubSearchWS.send($('#hub-search').val());
            });

        });
    }

    public setup(u, p) {
        this.login(u, p);
    }

    public login(u, p) {

        var self: any = this;

        $.ajax({
            type: 'POST',
            url: 'http://localhost:1212/login',
            data: { username: u, password: p },
            success: function(data, textStatus, xhr) {

                if (xhr.status != 200) {

                    console.log(data.responseText);

                } else {

                    console.log(data);
                    
                    self.username = data.username;
                    self.id = data.id;
                    self.token = data.token;

                    my_token = data.token;
                    my_id = data.id;


                    self.createHub();

                    self.loadHubs();
                    self.loadFriends();

                }
            },
            error: function(data, textStatus, xhr) {
                console.log(data.responseText);
            }
        });

    }


    public register(u, p) {

        var self: any = this;

        $.ajax({
            type: 'POST',
            url: 'http://localhost:1212/register',
            data: { username: u, password: p },
            success: function(data, textStatus, xhr) {
                if (xhr.status != 200) {
                    console.log(data.responseText);
                } else {
                    var js = JSON.parse(data);
                    console.log(js);

                    self.login(u, p);

                }

            },
            error: function(data, textStatus, xhr) {
                console.log(data.responseText);

                // already logged in
                self.login(u, p);

            }
        });

    }


    public createHub() {

        var self: any = this;

        var hub_id = 'privatehub';

        var visibility = 'private';
        var url = 'http://localhost:1212/create-hub?token=' + this.token;

        $.ajax({
            type: 'POST',
            url: url,
            data: {
                hub_id: hub_id,
                hub_visibility: visibility
            },
            success: function(data, textStatus, xhr) {
                if (xhr.status != 200) {
                    console.log(data.responseText);
                } else {
                    console.log('hub successfully created');
                    var js = JSON.parse(data);
                    console.log(js);


                    self.joinHub(hub_id);

                }
            },
            error: function(data, textStatus, xhr) {
                console.log(data.responseText);

                // hub already exists
                self.joinHub(hub_id);

            }
        });

    }

    public joinHub(hub_id) {
        var self: any = this;

        if (this.ws != null) this.ws.close();

        this.ws = new WebSocket("ws://localhost:1212/ws?token=" + this.token + "&hub=" + hub_id);

        self.waitForSocketConnection(this.ws, function() {

            console.log("Connected.");

            self.loadHubMessages(hub_id);

            self.ws.onmessage = function (evt) {

                var messages = evt.data.split('\n');
                if (messages.length > 0) {
                    var msg = JSON.parse(messages[0]);
                    console.log(msg);
                    messageHandler.send(msg);
                } else {
                    console.log("error parsing message!");
                }
            };
        });

    }

    private waitForSocketConnection(socket, callback){
        setTimeout(function () {
                if (socket.readyState === 1) {
                    if(callback != null) {
                        callback();
                    }
                    return;
                } else {
                    console.log("Waiting to connect.");
                    this.waitForSocketConnection(socket, callback);
                }
            },
        5); // wait 5 miliseconds
    }


    public sendMessage(msg){
        var self: any = this;

        if (self.ws == null) {
            console.log('you are not connected.');
            return;
        }

        self.waitForSocketConnection(self.ws, function() {
            self.ws.send(JSON.stringify({
                ID: my_id,
                username: self.username,
                Message: msg
            }));
        });

    }


    // Hub Search Websocket

    public connectHubSearchWebsocket() {
        var self: any = this;

        self.hubSearchWS = new WebSocket("ws://localhost:1212/ws/find-hubs");
        self.waitForSocketConnection(self.hubSearchWS, function() {
            console.log("Connected to hub search websocket.");



            self.hubSearchWS.onmessage = function (evt) {

                $('#hubs__title').text('Search Results');

                var results = evt.data.split('\n');

                if (results.length > 0) {

                    var json = JSON.parse(results[0]);

                    console.log(json);

                    tabManager.emptyHubList();
                    var hubs = Array<any>();
                    for (var hub in json) {
                        tabManager.addItemToHubList(json[hub].ID, json[hub].Visibility);
                    }

                } else {
                    console.log("error parsing message!");
                }
            };
        });

    }


    // Load Hubs
    public loadHubs() {
        var self: any = this;
        $.ajax({
            type: 'GET',
            url: "http://localhost:1212/my-hubs?token=" + my_token,
            success: function(data, textStatus, xhr) {
                if (xhr.status != 200) {
                    console.log(data.responseText);
                } else {
                    var json = JSON.parse(data);
                    tabManager.emptyHubList();
                    for (var hub in json) {
                        tabManager.addItemToHubList(json[hub].ID, json[hub].Visibility);
                    }
                }
            },
            error: function(data, textStatus, xhr) {
                console.log(data.responseText);
            }
        });
    }

    // Load Hub Messages
    loadHubMessages(hub_id) {
        var self: any = this;
        $.ajax({
            type: 'GET',
            url: "http://localhost:1212/hub-messages/" + hub_id + "?token=" + my_token,
            success: function(data, textStatus, xhr) {
                if (xhr.status != 200) {
                    console.log(data.responseText);
                } else {
                    messageManager.clearMessages();
                    messageHandler.clearMessages();

                    var json = JSON.parse(data);

                    // save messages
                    for (var m in json) {
                        var message = json[m];
                        var new_message: Message = {
                            message: message.Message,
                            sender_username: message.Username,
                            sender_id: message.ID,
                            sender_token: "",
                        }
                        messageManager.addMessage(new_message);
                    }

                    // load them into the ui
                    fluidMotion.loadFluidMotionElementsFromArray(messageManager.getAllMessages());
                }
            },
            error: function(data, textStatus, xhr) {
                console.log(data.responseText);
            }
        });
    }

    // Load Friends
    public loadFriends() {
        var self: any = this;
        $.ajax({
            type: 'GET',
            url: "http://localhost:1212/my-friends?token=" + my_token,
            success: function(data, textStatus, xhr) {
                if (xhr.status != 200) {
                    console.log(data.responseText);
                } else {
                    var json = JSON.parse(data);
                    tabManager.emptyFriendList();
                    for (var hub in json) {
                        tabManager.addItemToFriendList(json[hub].Username);
                    }
                }
            },
            error: function(data, textStatus, xhr) {
                console.log(data.responseText);
            }
        });
    }

}

